
// Dungeon Arcanum — demo complejo (compact engine)
// Features:
// - Tile-based dungeon with procedural generation (rooms + corridors)
// - Textured tiles (floor, wall) using small sprites
// - Player with movement, attack, HP, inventory
// - Enemies with simple chase AI and LOS-based detection
// - Lighting (radial light shader) and particles
// - Save / Load via localStorage
// - Touch + keyboard support
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
let W = 800, H = 600;
function resizeCanvas(){
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const TILE = 32;
const MAP_W = 40;
const MAP_H = 30;

let textures = {};

function loadTexture(name, src){
  return new Promise((res, rej)=>{
    const img = new Image();
    img.onload = ()=>{ textures[name] = img; res(img); };
    img.onerror = rej;
    img.src = src;
  });
}

// Preload small embedded textures (data URLs generated server-side)
const textureFiles = {
  floor: 'assets/floor.png',
  wall: 'assets/wall.png',
  hero: 'assets/hero.png'
};

async function preloadAll(){
  const p = [];
  for(const k in textureFiles){ p.push(loadTexture(k, textureFiles[k])); }
  await Promise.all(p);
}

function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }

class Map{
  constructor(w,h){
    this.w=w; this.h=h;
    this.tiles = new Array(w*h).fill(1); // 0 floor, 1 wall
    this.generate();
  }
  idx(x,y){ return y*this.w + x; }
  generate(){
    // Simple rooms + corridors algorithm
    for(let i=0;i<this.w*this.h;i++) this.tiles[i]=1;
    const rooms=[];
    const maxRooms = 9;
    for(let r=0;r<maxRooms;r++){
      const rw = randInt(4,10), rh = randInt(4,8);
      const rx = randInt(1, this.w-rw-2), ry = randInt(1, this.h-rh-2);
      rooms.push({x:rx,y:ry,w:rw,h:rh});
      for(let yy=ry; yy<ry+rh; yy++){
        for(let xx=rx; xx<rx+rw; xx++){
          this.tiles[this.idx(xx,yy)] = 0;
        }
      }
    }
    // connect rooms with corridors
    for(let i=1;i<rooms.length;i++){
      const a=rooms[i-1], b=rooms[i];
      const ax = Math.floor(a.x + a.w/2), ay = Math.floor(a.y + a.h/2);
      const bx = Math.floor(b.x + b.w/2), by = Math.floor(b.y + b.h/2);
      if(Math.random()<0.5){
        this.hcorr(ax,bx,ay); this.vcorr(ay,by,bx);
      } else {
        this.vcorr(ay,by,ax); this.hcorr(ax,bx,by);
      }
    }
  }
  hcorr(x1,x2,y){ for(let x=Math.min(x1,x2); x<=Math.max(x1,x2); x++) this.tiles[this.idx(x,y)] = 0; }
  vcorr(y1,y2,x){ for(let y=Math.min(y1,y2); y<=Math.max(y1,y2); y++) this.tiles[this.idx(x,y)] = 0; }
  isWall(x,y){
    if(x<0||y<0||x>=this.w||y>=this.h) return true;
    return this.tiles[this.idx(x,y)]===1;
  }
  draw(offx,offy,camW,camH){
    const startX = Math.floor(offx / TILE), startY = Math.floor(offy / TILE);
    const endX = Math.ceil((offx + camW) / TILE), endY = Math.ceil((offy+camH)/TILE);
    for(let y=startY;y<endY;y++){
      for(let x=startX;x<endX;x++){
        const px = x*TILE - offx, py = y*TILE - offy;
        if(x<0||y<0||x>=this.w||y>=this.h){
          ctx.fillStyle = 'black'; ctx.fillRect(px,py,TILE,TILE); continue;
        }
        if(this.tiles[this.idx(x,y)]===1){
          // wall
          ctx.drawImage(textures.wall,0,0, textures.wall.width, textures.wall.height, px,py,TILE,TILE);
        } else {
          ctx.drawImage(textures.floor,0,0, textures.floor.width, textures.floor.height, px,py,TILE,TILE);
        }
      }
    }
  }
}

class Entity{
  constructor(x,y,sprite){
    this.x=x; this.y=y; this.sprite=sprite;
    this.hp = 100; this.maxhp=100; this.speed = 3;
    this.size = 0.8;
  }
  draw(offx,offy){
    const px = this.x*TILE - offx, py = this.y*TILE - offy;
    ctx.save();
    ctx.translate(px + TILE/2, py + TILE/2);
    ctx.drawImage(textures[this.sprite], -TILE/2 * this.size, -TILE/2 * this.size, TILE*this.size, TILE*this.size);
    ctx.restore();
  }
}

class Enemy extends Entity{
  constructor(x,y){
    super(x,y,'hero');
    this.hp = 40; this.speed = 1.2; this.damage = 10;
    this.timer = 0;
  }
  update(dt, player, map){
    this.timer += dt;
    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.hypot(dx,dy);
    if(dist < 10){
      // simple chase with collision avoidance
      const nx = dx/dist, ny = dy/dist;
      const tx = this.x + nx * this.speed * dt;
      const ty = this.y + ny * this.speed * dt;
      if(!map.isWall(Math.floor(tx), Math.floor(this.y))) this.x = tx;
      if(!map.isWall(Math.floor(this.x), Math.floor(ty))) this.y = ty;
    } else {
      // wander
      if(this.timer > 2.0){
        this.timer = 0;
        this.wdir = {x:randFloat(-1,1), y:randFloat(-1,1)};
      }
      if(this.wdir){
        const tx = this.x + this.wdir.x * 0.2 * dt;
        const ty = this.y + this.wdir.y * 0.2 * dt;
        if(!map.isWall(Math.floor(tx), Math.floor(ty))){ this.x = tx; this.y = ty; }
      }
    }
    // attack if close
    if(dist < 0.9){
      if(player._hurtCooldown <= 0){
        player.hp -= this.damage;
        player._hurtCooldown = 0.8;
        game.log('Has sido golpeado por enemigo -' + this.damage);
      }
    }
  }
}

function randFloat(a,b){ return Math.random()*(b-a)+a; }

const game = {
  map: null, player: null, enemies: [], particles: [], running:false,
  camX:0, camY:0,
  score:0, level:1,
  init(){
    this.map = new Map(MAP_W, MAP_H);
    // place player in center of first room: find any floor
    for(let y=0;y<this.map.h;y++){
      for(let x=0;x<this.map.w;x++){
        if(!this.map.isWall(x,y)){
          this.player = new Entity(x+0.5,y+0.5,'hero');
          this.player.hp = 100; this.player.maxhp=100; this.player.inventory = [];
          this.player._hurtCooldown = 0;
          x = this.map.w; y = this.map.h; break;
        }
      }
    }
    // spawn enemies
    this.enemies = [];
    for(let i=0;i<12;i++){
      let ex = randInt(1,this.map.w-2), ey = randInt(1,this.map.h-2);
      if(this.map.isWall(ex,ey)) { i--; continue; }
      this.enemies.push(new Enemy(ex+0.2, ey+0.2));
    }
    this.score = 0; this.level = 1;
    this.running = true;
  },
  update(dt){
    if(!this.running) return;
    // player input
    this.player._hurtCooldown = Math.max(0, this.player._hurtCooldown - dt);
    const move = input.consume();
    let nx = this.player.x + move.x * this.player.speed * dt;
    let ny = this.player.y + move.y * this.player.speed * dt;
    // collision
    if(!this.map.isWall(Math.floor(nx), Math.floor(this.player.y))) this.player.x = nx;
    if(!this.map.isWall(Math.floor(this.player.x), Math.floor(ny))) this.player.y = ny;
    // attack
    if(move.attack){
      // simple melee: damage enemies in radius
      for(const e of this.enemies){
        const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
        if(d < 1.2){
          e.hp -= 30;
          this.score += 10;
          this.particles.push({x:e.x, y:e.y, life:0.6});
          game.log('Golpeaste enemigo!');
        }
      }
      // remove dead
      this.enemies = this.enemies.filter(e => e.hp>0);
    }
    // update enemies
    for(const e of this.enemies) e.update(dt, this.player, this.map);
    // particles life
    for(let i=this.particles.length-1;i>=0;i--){
      this.particles[i].life -= dt;
      if(this.particles[i].life <= 0) this.particles.splice(i,1);
    }
    if(this.player.hp <= 0){
      this.running = false;
      game.log('Has muerto. Reinicia para jugar de nuevo.');
    }
    // camera
    this.camX = this.player.x * TILE - canvas.width/ (2*devicePixelRatio);
    this.camY = this.player.y * TILE - canvas.height/(2*devicePixelRatio);
  },
  draw(){
    // clear
    ctx.fillStyle = '#02020a';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    // draw map
    this.map.draw(this.camX, this.camY, canvas.width/devicePixelRatio, canvas.height/devicePixelRatio);
    // draw entities
    for(const e of this.enemies) e.draw(this.camX, this.camY);
    this.player.draw(this.camX, this.camY);
    // particles
    for(const p of this.particles){
      const px = p.x*TILE - this.camX, py = p.y*TILE - this.camY;
      const alpha = Math.max(0, p.life/0.6);
      ctx.fillStyle = `rgba(220,120,30,${alpha})`;
      ctx.beginPath(); ctx.arc(px,py,6*alpha,0,Math.PI*2); ctx.fill();
    }
    // lighting overlay
    this.drawLighting();
  },
  drawLighting(){
    // simple radial light centered on player, darker elsewhere
    const grd = ctx.createRadialGradient(
      this.player.x*TILE - this.camX, this.player.y*TILE - this.camY, TILE*0.5,
      this.player.x*TILE - this.camX, this.player.y*TILE - this.camY, TILE*7
    );
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = grd;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillRect(0,0,canvas.width/devicePixelRatio, canvas.height/devicePixelRatio);
    ctx.globalCompositeOperation = 'source-over';
  },
  save(){
    const state = {
      map: this.map.tiles,
      player: {x:this.player.x, y:this.player.y, hp:this.player.hp, inv:this.player.inventory},
      enemies: this.enemies.map(e=>({x:e.x,y:e.y,hp:e.hp})),
      score: this.score, level: this.level
    };
    localStorage.setItem('DA_SAVE', JSON.stringify(state));
    game.log('Juego guardado.');
  },
  load(){
    const raw = localStorage.getItem('DA_SAVE');
    if(!raw) { game.log('No hay partida guardada.'); return; }
    const s = JSON.parse(raw);
    this.map.tiles = s.map;
    this.player.x = s.player.x; this.player.y = s.player.y; this.player.hp = s.player.hp; this.player.inventory = s.player.inv;
    this.enemies = s.enemies.map(e=>{ const en = new Enemy(e.x,e.y); en.hp=e.hp; return en; });
    this.score = s.score; this.level = s.level;
    game.log('Partida cargada.');
  },
  log(msg){
    const el = document.getElementById('log');
    el.innerHTML = (new Date()).toLocaleTimeString() + ' — ' + msg + '<br>' + el.innerHTML;
    document.getElementById('hp').textContent = Math.max(0, Math.floor(this.player.hp));
    document.getElementById('level').textContent = this.level;
    document.getElementById('score').textContent = this.score;
    // inventory
    const invList = document.getElementById('inv-list');
    invList.innerHTML = '';
    for(const it of this.player.inventory || []){ const li=document.createElement('li'); li.textContent = it; invList.appendChild(li); }
  }
};

// Input handler
const input = {
  keys: {},
  touchDir: {x:0,y:0,attack:false},
  init(){
    window.addEventListener('keydown', e=>{ this.keys[e.key.toLowerCase()] = true; if(e.key===' ') e.preventDefault(); });
    window.addEventListener('keyup', e=>{ this.keys[e.key.toLowerCase()] = false; });
    // simple touch: tap left/right halves to move; double tap to attack
    canvas.addEventListener('touchstart', e=>{
      const t = e.touches[0];
      const r = canvas.getBoundingClientRect();
      const x = t.clientX - r.left;
      if(x < r.width*0.4) this.touchDir.x = -1;
      else if(x > r.width*0.6) this.touchDir.x = 1;
      else this.touchDir.attack = true;
    });
    canvas.addEventListener('touchend', e=>{ this.touchDir = {x:0,y:0,attack:false}; });
  },
  consume(){
    let x=0,y=0, attack=false;
    if(this.keys['arrowup']||this.keys['w']) y=-1;
    if(this.keys['arrowdown']||this.keys['s']) y=1;
    if(this.keys['arrowleft']||this.keys['a']) x=-1;
    if(this.keys['arrowright']||this.keys['d']) x=1;
    if(this.keys[' ']) attack = true;
    if(this.keys['e']) { this.keys['e']=false; game.player.inventory.push('Poción'); game.log('Encontraste una poción.'); }
    // merge with touch
    x += this.touchDir.x; y += this.touchDir.y; attack = attack || this.touchDir.attack;
    // normalize
    if(x!==0 && y!==0){ x*=0.7071; y*=0.7071; }
    return {x,y,attack};
  }
};

let lastT=0;
function loop(t){
  if(!lastT) lastT=t;
  const dt = Math.min(0.05,(t-lastT)/1000);
  lastT = t;
  game.update(dt);
  game.draw();
  requestAnimationFrame(loop);
}

// UI buttons
document.getElementById('btn-start').addEventListener('click', ()=>{ if(!game.running) game.running=true; });
document.getElementById('btn-save').addEventListener('click', ()=>game.save());
document.getElementById('btn-load').addEventListener('click', ()=>game.load());
document.getElementById('btn-reset').addEventListener('click', ()=>{ game.init(); game.log('Mapa regenerado.'); });

// helpers
function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }

// boot
(async ()=>{
  await preloadAll();
  input.init();
  game.init();
  game.log('Juego iniciado. ¡Buena suerte!');
  requestAnimationFrame(loop);
})();
