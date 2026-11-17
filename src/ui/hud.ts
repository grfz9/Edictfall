// HUD en jeu : mis à jour à chaque frame, mais ne touche au DOM que quand une valeur affichée change.
import type { Game } from '../main';
import type { Player, Interactable, Enemy } from '../core/types';
import { RARITY_COLORS, RARITY_NAMES } from '../core/damage';
import { WORLD_NAMES, MODE_NAMES } from '../sim/world';
import { $, esc, fillIcons, pix, pixUrl, replay, instStats, fmt, modKindLabel, spriteFit } from './dom';
import { Minimap } from './minimap';
import { R } from '../core/registry';

/** Options d'affichage propres à l'UI, rangées dans save.options (champ supplémentaire, ignoré par le reste du jeu). */
export type UIOptions = { showFps?: boolean; perf?: 'auto' | 'on' | 'off' };
export const uiOpts = (g: Game) => g.save.options as Game['save']['options'] & UIOptions;

class StatBar {
  readonly el: HTMLElement;
  private fill: HTMLElement;
  private ghost: HTMLElement;
  private segs: HTMLElement;
  private val: HTMLElement;
  private v = -1;
  private max = -1;
  constructor(private kind: 'hp' | 'ar' | 'en', icon: string, private unit = 1, mini = false) {
    this.el = document.createElement('div');
    this.el.className = `stat ${kind}${mini ? ' mini' : ''}`;
    this.el.innerHTML = `${pix(icon, mini ? 1 : 2, 'sic')}<div class="sbar"><i class="ghost"></i><i class="fill"></i><b class="segs"></b></div><span class="sv"></span>`;
    this.fill = $('.fill', this.el); this.ghost = $('.ghost', this.el); this.segs = $('.segs', this.el); this.val = $('.sv', this.el);
  }
  set(v: number, max: number): void {
    if (v === this.v && max === this.max) return;
    const first = this.v < 0;
    if (!first && v < this.v) replay(this.el, 'hurt');
    if (!first && v > this.v && this.kind !== 'en') replay(this.el, 'gain');
    if (max !== this.max) {
      const n = Math.max(1, Math.min(30, Math.round(max / this.unit)));
      this.segs.style.backgroundSize = `${100 / n}% 100%`;
    }
    this.v = v; this.max = max;
    const pct = max > 0 ? Math.max(0, Math.min(1, v / max)) * 100 : 0;
    this.fill.style.width = pct + '%';
    this.ghost.style.width = pct + '%';
    this.val.textContent = `${v}/${max}`;
    this.el.classList.toggle('low', this.kind === 'hp' && max > 0 && v <= Math.max(1, max / 3));
    this.el.classList.toggle('empty', max <= 0);
  }
}

class PlayerCard {
  readonly el: HTMLElement;
  private hp: StatBar;
  private ar: StatBar;
  private en: StatBar;
  private portrait: HTMLElement;
  private heroId = '';
  private tag: HTMLElement;
  constructor(private index: number) {
    const mini = index > 0;
    this.el = document.createElement('div');
    this.el.className = 'pcard' + (mini ? ' p2' : ' p1');
    this.el.innerHTML = `<div class="portrait"><span class="ptag"></span></div><div class="pstats"></div>`;
    this.portrait = $('.portrait', this.el);
    this.tag = $('.ptag', this.el);
    this.hp = new StatBar('hp', 'heart', 1, mini);
    this.ar = new StatBar('ar', 'shield', 1, mini);
    this.en = new StatBar('en', 'bolt', 20, mini);
    $('.pstats', this.el).append(this.hp.el, this.ar.el, this.en.el);
  }
  update(g: Game, p: Player, tag: string): void {
    const w = g.world;
    if (p.hero.id !== this.heroId) {
      this.heroId = p.hero.id;
      this.portrait.querySelector('canvas')?.remove();
      try { this.portrait.prepend(spriteFit(p.hero.sprite, this.index ? 26 : 38)); } catch { /* sprite manquant */ }
      this.portrait.title = p.hero.name + ' — ' + p.hero.title;
    }
    if (this.tag.textContent !== tag) this.tag.textContent = tag;
    this.hp.set(Math.max(0, Math.ceil(p.hp)), w.maxHp(p));
    this.ar.set(Math.max(0, Math.ceil(p.armor)), w.maxArmor(p));
    this.en.set(Math.max(0, Math.floor(p.energy)), w.maxEnergy(p));
    this.el.classList.toggle('downed', p.downed);
  }
}

export class Hud {
  readonly el: HTMLElement;
  private cache = new Map<string, string>();
  private p1 = new PlayerCard(0);
  /** Cartes réduites des autres joueurs (coop locale ou en ligne). */
  private others = [new PlayerCard(1), new PlayerCard(2), new PlayerCard(3)];
  private map = new Minimap();
  private mapT = 0;
  private bossGhostT = 0;
  private bossShown = 1;
  private fpsT = 0;
  private touchLayer = document.getElementById('touch');

  constructor(private game: Game) {
    const el = (this.el = document.createElement('div'));
    el.id = 'hud';
    el.innerHTML = `
      <div class="hud-tl">
        <div class="p1slot"></div>
        <div class="money"><span class="mi">${pix('coin', 2)}<b id="h-coins">0</b></span><span class="mi gem">${pix('gem', 2)}<b id="h-gems">0</b></span></div>
        <div class="p2slot"></div>
      </div>
      <div class="hud-tc">
        <div id="h-floor"></div>
        <div id="h-boss" aria-live="polite"><div class="bname"><b></b><small></small></div><div class="bbar"><i class="ghost"></i><i class="fill"></i><span class="ticks"></span></div></div>
      </div>
      <div class="hud-tr">
        <div class="maprow"><button id="h-pause" class="hbtn" aria-label="Pause" title="Pause (Échap)">${pix('pause', 2)}</button><div class="mapbox"></div></div>
        <div id="h-rules"></div>
        <div id="h-net"></div>
      </div>
      <div class="hud-br"><div id="h-weapons"></div><div id="h-skill"><div class="sk-ring"><img class="sk-ic" src="${pixUrl('star', 3)}" alt=""><em></em></div><div class="sk-txt"><b></b><kbd></kbd></div></div></div>
      <div id="h-prompt"></div>
      <div id="h-hub"></div>
      <div id="h-fps"></div>`;
    $('.p1slot', el).appendChild(this.p1.el);
    for (const c of this.others) $('.p2slot', el).appendChild(c.el);
    $('.mapbox', el).appendChild(this.map.el);
    $('#h-pause', el).addEventListener('click', () => this.game.togglePause());
    el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-hud]') as HTMLElement | null;
      if (b?.dataset.hud === 'coop') { this.game.toggleCoop(); this.cache.delete('hub'); }
      if (b?.dataset.hud === 'online') this.game.ui.openPanel('online');
    });
  }

  private set(sel: string, html: string): void {
    if (this.cache.get(sel) === html) return;
    this.cache.set(sel, html);
    $(sel, this.el).innerHTML = html;
    fillIcons($(sel, this.el));
  }
  private changed(key: string, v: string): boolean {
    if (this.cache.get(key) === v) return false;
    this.cache.set(key, v);
    return true;
  }
  /** Force la reconstruction complète au prochain frame. */
  reset(): void { this.cache.clear(); }

  update(dt: number): void {
    const g = this.game, w = g.world, li = g.localIndex, p = w.players[li] ?? w.players[0];
    if (!p) return;
    const run = w.mode === 'run';
    const coop = w.players.length > 1;
    // en ligne : la grande carte est MON joueur, les autres en petit avec leur pseudo
    const names = g.net.names();
    const tagOf = (q: Player) => (names ? names[q.index] ?? `J${q.index + 1}` : coop ? `J${q.index + 1}` : '');
    this.p1.update(g, p, tagOf(p));
    const rest = w.players.filter((q) => q !== p);
    this.others.forEach((c, i) => {
      const q = rest[i];
      c.el.style.display = q ? '' : 'none';
      if (q) c.update(g, q, tagOf(q));
    });
    this.net(dt);

    this.set('#h-coins', String(w.coins));
    this.set('#h-gems', String(run ? w.gems : g.save.gems));
    $('.money', this.el).classList.toggle('hub', !run);
    this.set('#h-floor', run
      ? (w.runMode === 'endless'
        ? `<b>Ét. ${w.depth() + 1}</b><span>Infini · ${esc(WORLD_NAMES[w.worldNum] ?? '')}</span><em title="Score">${w.score()}</em>`
        : `<b>${w.worldNum}-${w.floorNum}</b><span>${w.runMode === 'daily' ? 'Défi · ' : ''}${esc(WORLD_NAMES[w.worldNum] ?? '')}</span>${w.loop ? `<em title="Boucle">${pix('loop', 1)}${w.loop + 1}</em>` : ''}`)
      : '<b>LE HALL</b>');

    this.weapons(p);
    this.skill(p, dt);
    this.rules();
    this.boss(dt);
    this.prompt(p, w.focus[li] ?? null);
    this.hub();

    // minimap : 10 Hz
    this.map.el.parentElement!.style.display = run ? '' : 'none';
    if (run && (this.mapT -= dt) <= 0) { this.mapT = 0.1; this.map.draw(w, 0.1); }

    const showFps = !!uiOpts(g).showFps;
    if ((this.fpsT -= dt) <= 0 || !showFps) {
      this.fpsT = 0.5;
      this.set('#h-fps', showFps ? `${Math.round(g.fps)} FPS` : '');
    }
  }

  // ------------------------------------------------------------------ armes
  private weapons(p: Player): void {
    const m = p.mods;
    const cost = (i: number) => (m.energyInfinite ? 0 : Math.round(p.weapons[i].def.energy * m.energyCost));
    const poor = (i: number) => !m.energyInfinite && p.energy < cost(i);
    const dev = this.game.input.device;
    const key = p.weapons.map((x, i) => x.def.id + x.rarity + (poor(i) ? 'p' : '') + cost(i)).join(',') + '|' + p.cur + dev;
    if (!this.changed('weapons', key)) return;
    const el = $('#h-weapons', this.el);
    const swapKey = dev === 'pad' ? 'Y' : dev === 'touch' ? '' : 'Tab';
    const order = p.weapons.map((_, i) => i).sort((a, b) => (a === p.cur ? -1 : b === p.cur ? 1 : a - b));
    el.innerHTML = order.map((i) => {
      const x = p.weapons[i], c = RARITY_COLORS[x.rarity] ?? '#fff', cur = i === p.cur;
      const en = m.energyInfinite ? '∞' : String(cost(i));
      return cur
        ? `<div class="wslot cur ${poor(i) ? 'poor' : ''}" style="--rc:${c}" title="${esc(RARITY_NAMES[x.rarity] ?? '')}"><span class="wic" data-icon="${x.def.sprite}" data-fit="40"></span><div class="winfo"><b>${esc(x.def.name)}</b><small>${pix('bolt', 1)}${en}${poor(i) ? ' <em>Énergie !</em>' : ''}</small></div></div>`
        : `<div class="wslot alt ${poor(i) ? 'poor' : ''}" style="--rc:${c}" title="${esc(x.def.name)}"><span class="wic" data-icon="${x.def.sprite}" data-fit="24"></span><small>${pix('bolt', 1)}${en}</small>${swapKey ? `<kbd>${swapKey}</kbd>` : ''}</div>`;
    }).join('');
    fillIcons(el);
  }

  private skill(p: Player, _dt: number): void {
    const sk = $('#h-skill', this.el);
    const total = Math.max(0.01, p.hero.skill.cooldown * p.mods.skillCd);
    const cd = p.skillCd > 0 ? Math.min(1, p.skillCd / total) : 0;
    const active = p.skillT > 0;
    const dev = this.game.input.device;
    const k = `${Math.round(cd * 100)}|${active}|${Math.ceil(p.skillCd)}|${p.hero.id}|${dev}`;
    if (!this.changed('skill', k)) return;
    sk.style.setProperty('--cd', String(cd));
    sk.classList.toggle('ready', cd <= 0);
    sk.classList.toggle('active', active);
    $('em', sk).textContent = cd > 0 ? String(Math.ceil(p.skillCd)) : '';
    $('.sk-txt b', sk).textContent = p.hero.skill.name;
    $('.sk-txt kbd', sk).textContent = dev === 'pad' ? 'B' : 'Espace';
    sk.title = `${p.hero.skill.name} — ${p.hero.skill.desc}`;
    if (this.touchLayer) {
      this.touchLayer.style.setProperty('--skcd', String(cd));
      this.touchLayer.style.setProperty('--skready', cd <= 0 ? '1' : '0');
    }
  }

  // ------------------------------------------------------------------ règles actives
  private rules(): void {
    const w = this.game.world;
    const list = w.rules.order();
    const rk = list.map((i) => i.def.id + i.stacks + (i.muted ? 'm' : '')).join(',');
    if (!this.changed('rules', rk)) return;
    const el = $('#h-rules', this.el);
    const MAX = 18;
    const rank = (k: string) => (k === 'synergy' ? 0 : k === 'rule' ? 1 : 2);
    const sorted = [...list].sort((a, b) => rank(a.def.kind) - rank(b.def.kind) || a.order - b.order);
    const shown = sorted.slice(0, MAX), rest = sorted.slice(MAX);
    el.innerHTML = shown.map((i) => {
      const d = i.def;
      const tip = `<b>${esc(d.name)}</b>${i.stacks > 1 ? ` <span class="tx">×${i.stacks}</span>` : ''}<br>${esc(d.desc)}<br><i>${esc(modKindLabel(d))}${i.muted ? ' · en sourdine' : ''}</i>`;
      return `<span class="ric ${d.kind} ${d.flavor ?? ''} ${i.muted ? 'muted' : ''}" data-tip="${esc(tip)}" role="img" aria-label="${esc(d.name)}"><span data-icon="${d.icon}" data-fit="20"></span>${i.stacks > 1 ? `<i>×${i.stacks}</i>` : ''}</span>`;
    }).join('') + (rest.length ? `<span class="ric more" data-tip="${esc(rest.map((i) => `<b>${esc(i.def.name)}</b>`).join('<br>'))}">+${rest.length}</span>` : '');
    fillIcons(el);
  }

  // ------------------------------------------------------------------ boss
  private boss(dt: number): void {
    const w = this.game.world;
    const b: Enemy | null = w.boss && !w.boss.dead && w.boss.spawnT <= 0 ? w.boss : null;
    const hb = $('#h-boss', this.el);
    hb.classList.toggle('on', !!b);
    if (!b) { this.cache.delete('bossId'); return; }
    if (this.changed('bossId', String(b.id))) {
      $('.bname b', hb).textContent = b.def.name;
      $('.bname small', hb).textContent = b.champion ? 'Gardien' : b.def.boss?.title ?? '';
      const ticks = (b.def.boss?.phases ?? []).map((ph) => ph.hp).filter((h) => h > 0 && h < 1);
      $('.ticks', hb).innerHTML = ticks.map((h) => `<i style="left:${h * 100}%"></i>`).join('');
      this.bossShown = b.hp / b.maxHp;
    }
    const pct = Math.max(0, Math.min(1, b.hp / b.maxHp));
    if (pct < this.bossShown) {
      if (this.bossGhostT > 0) this.bossGhostT -= dt;
      else this.bossShown = Math.max(pct, this.bossShown - dt * 0.6);
    } else { this.bossShown = pct; this.bossGhostT = 0.45; }
    const k = `${Math.round(pct * 400)}|${Math.round(this.bossShown * 400)}|${b.phase}`;
    if (!this.changed('boss', k)) return;
    ($('.fill', hb)).style.width = pct * 100 + '%';
    ($('.ghost', hb)).style.width = this.bossShown * 100 + '%';
  }

  // ------------------------------------------------------------------ invite d'interaction
  private prompt(p: Player, f: Interactable | null): void {
    const g = this.game, w = g.world;
    if (!f || w.choice) { this.set('#h-prompt', ''); return; }
    const dev = g.input.device;
    const key = dev === 'touch' ? '<kbd class="tap">Tir</kbd>' : dev === 'pad' ? '<kbd class="pad">X</kbd>' : '<kbd>E</kbd>';
    const color = f.weapon ? RARITY_COLORS[f.weapon.rarity] : f.kind === 'portal' ? '#c9a0ff' : '#f4f0e0';
    let html = `<div class="pr-main">${key}<b style="color:${color}">${esc(f.label)}</b>`;
    if (f.price !== undefined) {
      const price = w.priceOf(f);
      html += `<span class="price ${w.coins < price ? 'poor' : ''}">${pix('coin', 1)}${price}</span>`;
    }
    html += '</div>';
    if (f.weapon) {
      const a = instStats(f.weapon), cur = p.weapons[p.cur];
      const b = cur ? instStats(cur) : null;
      const cmp = (x: number, y: number | undefined, higherBetter: boolean) => {
        if (y === undefined || Math.abs(x - y) < 0.05) return '<i class="eq">=</i>';
        return (x > y) === higherBetter ? '<i class="up">▲</i>' : '<i class="dn">▼</i>';
      };
      html += `<div class="pr-stats"><span class="rar" style="color:${color}">${esc(RARITY_NAMES[f.weapon.rarity] ?? '')}</span>`
        + `<span>⚔ ${fmt(a.dmg)}${a.count > 1 ? '×' + a.count : ''} ${cmp(a.total, b?.total, true)}</span>`
        + `<span>${pix('bolt', 1)}${a.energy} ${cmp(a.energy, b?.energy, false)}</span>`
        + `<span>◷ ${fmt(a.rate)}/s ${cmp(a.rate, b?.rate, true)}</span></div>`;
      if (cur) html += `<div class="pr-sub">En main : ${esc(cur.def.name)}</div>`;
    }
    if (f.sub) html += `<div class="pr-sub">${esc(f.sub)}</div>`;
    this.set('#h-prompt', html);
  }

  // ------------------------------------------------------------------ hall
  private hub(): void {
    const g = this.game, w = g.world;
    if (w.mode !== 'hub') { this.set('#h-hub', ''); return; }
    const coop = w.players.length > 1;
    const touch = g.input.device === 'touch';
    const net = g.net;
    if (net.active) {
      const host = net.role === 'host';
      this.set('#h-hub', `<div class="hub-hint">En ligne · Mode : <b class="hub-mode">${esc(MODE_NAMES[w.hubMode])}</b> · Approche un héros pour le choisir · ${host ? 'Entre dans le portail pour lancer la partie' : 'L\'hôte lance la partie'}</div>
        <div class="hub-coop"><button class="hbtn coop online" data-hud="online">Salon <b>${esc(net.code)}</b></button><span class="coop-keys">${net.lobby().length}/4 joueurs</span></div>`);
      return;
    }
    const html = `<div class="hub-hint">Mode : <b class="hub-mode">${esc(MODE_NAMES[w.hubMode])}</b> (tableau des défis) · Approche un héros pour le choisir · Portail pour partir</div>
      <div class="hub-coop"><button class="hbtn coop" data-hud="coop">${coop ? '− Retirer J2' : '+ Joueur 2'}${touch ? '' : ' <kbd>C</kbd>'}</button>
      <button class="hbtn coop online" data-hud="online">Multijoueur en ligne</button>
      ${coop ? '<span class="coop-keys">J2 : flèches · <kbd>Entrée</kbd> interagir · <kbd>Ctrl dr.</kbd> tirer · <kbd>Maj dr.</kbd> compétence · <kbd>/</kbd> arme — ou une manette</span>' : '<span class="coop-keys">Coop locale : clavier partagé ou manette</span>'}</div>`;
    this.set('#h-hub', html);
  }

  // ------------------------------------------------------------------ en ligne : joueurs du salon et ping
  private netT = 0;
  private net(dt: number): void {
    const g = this.game, net = g.net;
    if (!net.active) { this.set('#h-net', ''); return; }
    if ((this.netT -= dt) > 0) return;
    this.netT = 0.5;
    const li = g.localIndex;
    const rows = net.lobby().map((e, i) => {
      const hero = R.heroes.get(e.hero);
      const ping = e.host ? 'hôte' : i === li && net.role === 'guest' ? `${net.ping} ms` : `${e.ping} ms`;
      const cls = e.host ? '' : (i === li ? net.ping : e.ping) > 180 ? 'bad' : (i === li ? net.ping : e.ping) > 90 ? 'mid' : 'good';
      return `<div class="nrow ${i === li ? 'me' : ''}">${hero ? `<span data-icon="${hero.sprite}" data-fit="14"></span>` : ''}<b>${esc(e.name)}</b><em class="${cls}">${ping}</em></div>`;
    }).join('');
    this.set('#h-net', `<div class="nhead">Salon ${esc(net.code)}</div>${rows}`);
  }
}
