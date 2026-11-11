/*
 * Fábrica em 3D (three.js), carregada só na aba "Fábrica ao vivo".
 *
 * Três linhas com quatro estações cada, esteira, peças andando, inspeção no fim
 * (peça boa vai para o palete, peça com defeito cai na caixa vermelha) e paradas
 * de setup e de quebra ao longo do turno. O ritmo, as paradas e a taxa de defeito
 * vêm do modelo "e se" (src/simulacao.ts): a animação mostra o mesmo cenário que
 * os números ao lado.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LINES } from '../../dados';
import { TURNO_MIN, type Resultado } from '../../simulacao';

export type Estado = 'produzindo' | 'setup' | 'parada';
export type Selecao = { linha: number; estacao: number; nome: string; estado: Estado };
export type Placar = { linha: number; produzidas: number; boas: number; defeitos: number; estado: Estado; estacaoParada: number | null }[];
export type CoresCena = { fundo: string; chao: string; grade: string; maquina: string; maquina2: string; esteira: string; ok: string; alerta: string; ruim: string; destaque: string; tinta: string; serie: string[] };

export const ESTACOES = [
  ['Torno CNC', 'Fresadora', 'Retífica', 'Inspeção'],
  ['Pré-montagem', 'Aperto (torque)', 'Teste funcional', 'Inspeção'],
  ['Preparação', 'Cabine de pintura', 'Estufa', 'Inspeção'],
];
const XS = [-8.4, -2.8, 2.8, 8.4];
const X0 = -12, X1 = 13.2, X_INSP = 8.4;
const VEL = 3.2; // unidades de esteira por minuto simulado
const MAX_PECAS = 160;
const zLinha = (li: number) => (li - 1) * 7.5;

type Peca = { x: number; defeito: boolean | null; cai: number };
type Evento = { ini: number; fim: number; tipo: 'setup' | 'parada'; estacao: number };
type LinhaSim = {
  pecas: Peca[]; acum: number; eventos: Evento[]; ritmo: number; def: number;
  produzidas: number; boas: number; defeitos: number; palete: number; flash: number;
  inst: THREE.InstancedMesh; luzes: THREE.Mesh[]; caixa: THREE.Mesh[]; zona: THREE.Mesh; maquinas: THREE.Object3D[];
};

const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

export class Cena {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private linhas: LinhaSim[] = [];
  private clicaveis: THREE.Object3D[] = [];
  private ro: ResizeObserver;
  private raf = 0;
  private ultimo = 0;
  private minuto = 0; // minuto simulado dentro do turno
  private turno = 0;
  rodando = true;
  velocidade = 5; // minutos simulados por segundo
  private mats: Record<string, THREE.MeshStandardMaterial> = {};
  private dummy = new THREE.Object3D();
  private cor = new THREE.Color();
  private visivel = true;
  private io: IntersectionObserver;

  constructor(private el: HTMLElement, private cores: CoresCena, private aoSelecionar: (s: Selecao | null) => void) {
    // aparelho mais fraco (celular): sem sombras nem suavização, para não travar a tela
    const leve = el.clientWidth < 700 || (navigator.hardwareConcurrency ?? 8) <= 4;
    this.renderer = new THREE.WebGLRenderer({ antialias: !leve, alpha: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, leve ? 1.5 : 2));
    this.renderer.shadowMap.enabled = !leve;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    el.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 200);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = 1.38;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 70;
    this.visaoGeral();

    this.montar();
    this.aplicarCores();
    this.novoTurno();

    this.ro = new ResizeObserver(() => this.redimensionar());
    this.ro.observe(el);
    this.io = new IntersectionObserver(([e]) => { this.visivel = e.isIntersecting; });
    this.io.observe(el);
    this.renderer.domElement.addEventListener('pointerdown', this.onDown);
    this.renderer.domElement.addEventListener('pointerup', this.onUp);
    this.redimensionar();
    this.raf = requestAnimationFrame(this.loop);
  }

  /* ---------------- montagem da cena ---------------- */
  private mat(nome: string, opts: THREE.MeshStandardMaterialParameters = {}) {
    return (this.mats[nome] ??= new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.1, ...opts }));
  }

  private montar() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.6));
    const sol = new THREE.DirectionalLight(0xffffff, 1.5);
    sol.position.set(12, 26, 14);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    Object.assign(sol.shadow.camera, { left: -22, right: 22, top: 18, bottom: -18, near: 1, far: 70 });
    s.add(sol);

    const chao = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), this.mat('chao'));
    chao.rotation.x = -Math.PI / 2;
    chao.receiveShadow = true;
    s.add(chao);
    const grade = new THREE.GridHelper(60, 30);
    (grade.material as THREE.Material).transparent = true;
    (grade.material as THREE.Material).opacity = 0.35;
    grade.position.y = 0.01;
    grade.name = 'grade';
    s.add(grade);

    const caixaGeo = new THREE.BoxGeometry(1, 1, 1);
    LINES.forEach((_, li) => {
      const z = zLinha(li);
      // faixa do chão da linha (cor pelo OEE)
      const zona = new THREE.Mesh(new THREE.PlaneGeometry(27, 6.4), new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.16, roughness: 1 }));
      zona.rotation.x = -Math.PI / 2;
      zona.position.set(0.6, 0.02, z - 0.4);
      s.add(zona);

      // esteira
      const esteira = new THREE.Mesh(caixaGeo, this.mat('esteira'));
      esteira.scale.set(X1 - X0, 0.5, 1.3);
      esteira.position.set((X0 + X1) / 2, 0.55, z + 1.2);
      esteira.castShadow = esteira.receiveShadow = true;
      s.add(esteira);
      for (const x of [X0 + 0.3, X1 - 0.3]) {
        const pe = new THREE.Mesh(caixaGeo, this.mat('maquina2'));
        pe.scale.set(0.3, 0.55, 1.3);
        pe.position.set(x, 0.27, z + 1.2);
        s.add(pe);
      }

      // estações
      const luzes: THREE.Mesh[] = [], maquinas: THREE.Object3D[] = [];
      XS.forEach((x, k) => {
        const g = this.maquina(li, k);
        g.position.set(x, 0, z - 1.3);
        Object.assign(g.userData, { linha: li, estacao: k });
        s.add(g);
        maquinas.push(g);
        g.traverse((o) => { if ((o as THREE.Mesh).isMesh) this.clicaveis.push(o); });
        const luz = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshStandardMaterial({ emissiveIntensity: 1.4, roughness: 0.3 }));
        luz.position.set(x, g.userData.altura + 0.55, z - 1.3);
        s.add(luz);
        luzes.push(luz);
      });

      // palete das peças boas e caixa das com defeito
      const palete = new THREE.Mesh(caixaGeo, this.mat('palete', { color: 0xb08a5a }));
      palete.scale.set(1.8, 0.25, 1.8);
      palete.position.set(X1 + 1.3, 0.13, z + 1.2);
      palete.receiveShadow = true;
      s.add(palete);
      const caixa: THREE.Mesh[] = [];
      const cx = X_INSP + 1.2, cz = z + 2.9;
      for (const [w, d, px, pz] of [[1.6, 0.12, 0, -0.75], [1.6, 0.12, 0, 0.75], [0.12, 1.6, -0.75, 0], [0.12, 1.6, 0.75, 0]] as const) {
        const p = new THREE.Mesh(caixaGeo, this.mat('caixa'));
        p.scale.set(w, 0.7, d);
        p.position.set(cx + px, 0.35, cz + pz);
        p.castShadow = true;
        s.add(p);
        caixa.push(p);
      }

      // peças (uma malha instanciada por linha)
      const geo = li === 0 ? new THREE.CylinderGeometry(0.18, 0.18, 0.9, 14).rotateZ(Math.PI / 2) : li === 1 ? new THREE.BoxGeometry(0.6, 0.45, 0.6) : new THREE.BoxGeometry(0.7, 0.3, 0.7);
      const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: li === 0 ? 0.7 : 0.2 }), MAX_PECAS);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      inst.castShadow = true;
      inst.count = 0;
      s.add(inst);

      this.linhas.push({ pecas: [], acum: 0, eventos: [], ritmo: 1.6, def: 0.017, produzidas: 0, boas: 0, defeitos: 0, palete: 0, flash: 0, inst, luzes, caixa, zona, maquinas });
    });
  }

  /** Cada estação com uma silhueta própria, para a cena não parecer uma fileira de caixas iguais. */
  private maquina(li: number, k: number) {
    const g = new THREE.Group();
    const caixa = (w: number, h: number, d: number, x: number, y: number, z: number, m = 'maquina') => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(m));
      b.position.set(x, y, z);
      b.castShadow = b.receiveShadow = true;
      g.add(b);
      return b;
    };
    let altura = 2.2;
    if (k === 3) { // inspeção: bancada com pórtico
      caixa(2.4, 1, 1.6, 0, 0.5, 0);
      caixa(0.15, 2.2, 0.15, -1.1, 1.6, 1.9, 'maquina2');
      caixa(0.15, 2.2, 0.15, 1.1, 1.6, 1.9, 'maquina2');
      caixa(2.4, 0.2, 0.3, 0, 2.7, 1.9, 'maquina2');
      altura = 2.8;
    } else if (li === 0) { // usinagem: corpo da máquina com janela
      caixa(2.6, 2, 2, 0, 1, 0);
      caixa(1.4, 0.9, 0.05, 0, 1.3, 1.03, 'vidro');
      caixa(0.5, 0.8, 0.5, 1.15, 2.2, -0.5, 'maquina2');
      altura = 2.6;
    } else if (li === 1) { // montagem: bancada e braço
      caixa(2.4, 0.9, 1.6, 0, 0.45, 0);
      const base = caixa(0.5, 0.4, 0.5, 0.5, 1.1, 0.2, 'maquina2');
      void base;
      caixa(0.22, 1.4, 0.22, 0.5, 1.95, 0.2, 'destaque');
      caixa(1.2, 0.2, 0.22, 0.05, 2.6, 0.55, 'destaque');
      altura = 2.7;
    } else { // pintura: cabine alta e estufa comprida
      if (k === 1) { caixa(2.6, 3, 2.2, 0, 1.5, 0, 'tinta'); altura = 3; }
      else if (k === 2) { caixa(3, 1.8, 2.2, 0, 0.9, 0); caixa(2.6, 0.2, 2.3, 0, 1.9, 0, 'maquina2'); altura = 2; }
      else { caixa(2.2, 1.4, 1.8, 0, 0.7, 0); altura = 1.6; }
    }
    g.userData.altura = altura;
    return g;
  }

  /* ---------------- cores (acompanham o tema) ---------------- */
  setCores(c: CoresCena) { this.cores = c; this.aplicarCores(); }
  private aplicarCores() {
    const c = this.cores;
    this.scene.background = new THREE.Color(c.fundo);
    this.mat('chao').color.set(c.chao);
    this.mat('maquina').color.set(c.maquina);
    this.mat('maquina2').color.set(c.maquina2);
    this.mat('esteira').color.set(c.esteira);
    this.mat('destaque').color.set(c.destaque);
    this.mat('tinta', { transparent: true, opacity: 0.85 }).color.set(c.tinta);
    this.mat('vidro', { transparent: true, opacity: 0.55, metalness: 0.4 }).color.set(c.destaque);
    this.mat('caixa').color.set(c.ruim);
    const grade = this.scene.getObjectByName('grade') as THREE.GridHelper | undefined;
    if (grade) (grade.material as THREE.LineBasicMaterial).color.set(c.grade);
  }

  /* ---------------- cenário ---------------- */
  private resultados: Resultado[] = [];
  setResultados(r: Resultado[], meta = 0.75) {
    this.resultados = r;
    r.forEach((x, li) => {
      const L = this.linhas[li];
      L.ritmo = x.produzidasTurno / Math.max(1, TURNO_MIN - x.paradoMin); // peças por minuto produzindo
      L.def = x.defeitoPct;
      const zm = L.zona.material as THREE.MeshStandardMaterial;
      zm.color.set(x.OEE >= meta ? this.cores.ok : x.OEE >= meta - 0.05 ? this.cores.alerta : this.cores.ruim);
    });
    this.planejarParadas(false);
  }

  /** Distribui o setup e as quebras do turno ao longo do tempo (mantendo o que já passou). */
  private planejarParadas(novo: boolean) {
    this.linhas.forEach((L, li) => {
      const r = this.resultados[li];
      if (!r) return;
      const quebra = Math.max(0, r.paradoMin - (r.paradoMin >= 0 ? this.setupMin(li) : 0));
      const passado = novo ? [] : L.eventos.filter((e) => e.fim <= this.minuto || e.ini <= this.minuto);
      const eventos: Evento[] = [...passado];
      const livre = (a: number, b: number) => eventos.every((e) => b <= e.ini || a >= e.fim);
      const por = (dur: number, tipo: Evento['tipo'], estacao: number) => {
        for (let t = 0; t < 40; t++) {
          const ini = Math.max(this.minuto + 1, 5 + rnd() * (TURNO_MIN - dur - 10));
          if (livre(ini, ini + dur)) { eventos.push({ ini, fim: ini + dur, tipo, estacao }); return; }
        }
      };
      if (novo || !passado.some((e) => e.tipo === 'setup')) por(this.setupMin(li), 'setup', -1);
      const resto = Math.max(0, quebra - passado.filter((e) => e.tipo === 'parada').reduce((s, e) => s + (e.fim - e.ini), 0));
      const n = resto > 30 ? 2 : resto > 2 ? 1 : 0;
      for (let k = 0; k < n; k++) por(resto / n, 'parada', Math.floor(rnd() * 3));
      L.eventos = eventos.sort((a, b) => a.ini - b.ini);
    });
  }
  private setupBase = 30;
  setSetup(min: number) { this.setupBase = min; }
  private setupMin(_li: number) { return this.setupBase; }

  private novoTurno() {
    this.minuto = 0;
    this.linhas.forEach((L) => { L.produzidas = L.boas = L.defeitos = 0; L.palete = 0; });
    this.planejarParadas(true);
  }

  /* ---------------- simulação ---------------- */
  private estado(L: LinhaSim): { estado: Estado; estacao: number | null } {
    const e = L.eventos.find((x) => this.minuto >= x.ini && this.minuto < x.fim);
    return e ? { estado: e.tipo === 'setup' ? 'setup' : 'parada', estacao: e.estacao >= 0 ? e.estacao : null } : { estado: 'produzindo', estacao: null };
  }

  private passo(dtMin: number) {
    this.minuto += dtMin;
    if (this.minuto >= TURNO_MIN) { this.turno = (this.turno + 1) % 3; this.novoTurno(); }
    this.linhas.forEach((L) => {
      const { estado } = this.estado(L);
      if (estado !== 'produzindo') return;
      L.acum += dtMin * L.ritmo;
      while (L.acum >= 1) {
        L.acum -= 1;
        if (L.pecas.length < MAX_PECAS) L.pecas.push({ x: X0 + 0.4, defeito: null, cai: 0 });
      }
      for (const p of L.pecas) {
        if (p.cai > 0) { p.cai += dtMin * 1.6; continue; }
        p.x += dtMin * VEL;
        if (p.defeito === null && p.x >= X_INSP) {
          p.defeito = rnd() < L.def;
          L.produzidas++;
          if (p.defeito) { L.defeitos++; p.cai = 0.001; L.flash = 1; } else L.boas++;
        }
      }
      // peças boas chegam ao palete; defeituosas terminam de cair na caixa
      const antes = L.pecas.length;
      L.pecas = L.pecas.filter((p) => !(p.x >= X1 && !p.defeito) && p.cai < 1);
      L.palete += antes - L.pecas.length;
    });
  }

  private desenhar(dtReal: number) {
    const c = this.cores;
    this.linhas.forEach((L, li) => {
      const z = zLinha(li) + 1.2;
      let i = 0;
      for (const p of L.pecas) {
        if (i >= MAX_PECAS) break;
        if (p.cai > 0) this.dummy.position.set(X_INSP + 1.2 * Math.min(1, p.cai * 2), 0.95 - 0.8 * p.cai, z + 1.7 * Math.min(1, p.cai * 2));
        else this.dummy.position.set(p.x, li === 0 ? 0.98 : 1.0, z);
        this.dummy.rotation.set(0, 0, p.cai * 3);
        this.dummy.updateMatrix();
        L.inst.setMatrixAt(i, this.dummy.matrix);
        L.inst.setColorAt(i, this.cor.set(p.defeito ? c.ruim : c.serie[li]));
        i++;
      }
      L.inst.count = i;
      L.inst.instanceMatrix.needsUpdate = true;
      if (L.inst.instanceColor) L.inst.instanceColor.needsUpdate = true;

      const { estado, estacao } = this.estado(L);
      L.flash = Math.max(0, L.flash - dtReal * 1.5);
      const pulso = 0.6 + 0.4 * Math.sin(performance.now() / 180);
      L.luzes.forEach((luz, k) => {
        const m = luz.material as THREE.MeshStandardMaterial;
        let cc = c.ok, intens = 1.2;
        if (estado === 'setup') { cc = c.destaque; intens = 0.9 + pulso * 0.6; }
        else if (estado === 'parada') { cc = estacao === k ? c.ruim : c.alerta; intens = estacao === k ? 0.8 + pulso : 0.8; }
        if (k === 3 && L.flash > 0) { cc = c.ruim; intens = 1 + L.flash * 2; }
        m.color.set(cc);
        m.emissive.set(cc);
        m.emissiveIntensity = intens;
      });
    });
  }

  private loop = (t: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (t - (this.ultimo || t)) / 1000);
    this.ultimo = t;
    if (!this.visivel || document.visibilityState === 'hidden') return;
    if (this.rodando) {
      // passos pequenos, para nenhuma peça "pular" a inspeção em velocidade alta
      let restante = dt * this.velocidade;
      while (restante > 0) { const d = Math.min(0.25, restante); this.passo(d); restante -= d; }
    }
    this.desenhar(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  /* ---------------- interação ---------------- */
  private down = { x: 0, y: 0 };
  private onDown = (e: PointerEvent) => { this.down = { x: e.clientX, y: e.clientY }; };
  private onUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 6) return; // foi arrasto, não clique
    const r = this.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const hit = ray.intersectObjects(this.clicaveis, false)[0];
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && o.userData.linha === undefined) o = o.parent;
    if (!o) { this.aoSelecionar(null); return; }
    this.selecionar(o.userData.linha, o.userData.estacao);
  };
  selecionar(linha: number, estacao: number) {
    const L = this.linhas[linha];
    const { estado, estacao: qual } = this.estado(L);
    this.aoSelecionar({ linha, estacao, nome: ESTACOES[linha][estacao], estado: estado === 'parada' && qual !== estacao ? 'parada' : estado });
    this.focar(linha, estacao);
  }
  private focar(linha: number, estacao: number) {
    const alvo = new THREE.Vector3(XS[estacao], 1, zLinha(linha));
    const dir = this.camera.position.clone().sub(this.controls.target).normalize().multiplyScalar(26);
    this.controls.target.copy(alvo);
    this.camera.position.copy(alvo.clone().add(dir));
  }
  visaoGeral() {
    this.controls.target.set(0.8, 0, 0.6);
    this.camera.position.set(9, 31, 28);
  }
  zoom(f: number) {
    const d = this.camera.position.clone().sub(this.controls.target).multiplyScalar(f);
    if (d.length() < this.controls.minDistance || d.length() > this.controls.maxDistance) return;
    this.camera.position.copy(this.controls.target.clone().add(d));
  }

  /** Placar ao vivo e relógio do turno, para a interface. */
  placar(): { relogio: string; turno: string; linhas: Placar } {
    const ini = [6, 14, 22][this.turno];
    const m = Math.floor(this.minuto), h = (ini + Math.floor(m / 60)) % 24;
    return {
      relogio: `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
      turno: ['A', 'B', 'C'][this.turno],
      linhas: this.linhas.map((L, li) => { const s = this.estado(L); return { linha: li, produzidas: L.produzidas, boas: L.boas, defeitos: L.defeitos, estado: s.estado, estacaoParada: s.estacao }; }),
    };
  }
  /** Posição na tela do rótulo de cada linha (para os textos por cima do 3D). */
  rotulos() {
    const r = this.renderer.domElement.getBoundingClientRect();
    return this.linhas.map((_, li) => {
      const v = new THREE.Vector3(X0 + 0.2, 0.1, zLinha(li) + 2.4).project(this.camera);
      return { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height, visivel: v.z < 1 };
    });
  }

  private redimensionar() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // em telas estreitas, recua a câmera para a fábrica inteira caber
    this.camera.fov = w < 600 ? 52 : 38;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.io.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.onDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onUp);
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/** O navegador consegue desenhar 3D? */
export function temWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
