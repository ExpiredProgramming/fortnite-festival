// main.js - paradise fest demo
// requires three.js and howler.js (loaded in index.html)

let scene, camera, renderer, controls, clock;
let avatar, floor, stage, lights = [];
const canvas = document.getElementById('glcanvas');

initThree();
initScene();
animate();

///////////// Audio + UI /////////////
const songListEl = document.getElementById('songs');
const uploadInput = document.getElementById('upload');
const playBtn = document.getElementById('playPause');
const nowEl = document.getElementById('now');

let howls = []; // list of {name, howl, src}
let current = null;
let analyser = null;
let audioContext = null;

// default demo placeholders (no copyrighted audio)
const defaults = [
  { name: "paradise demo (placeholder)", src: "assets/audio/demo-loop.mp3" }, 
  // add your own default filenames here if you host them
];

function addSongEntry(displayName, src, isLocal=false){
  const id = `${Math.random().toString(36).slice(2,9)}`;
  const li = document.createElement('li');
  li.dataset.src = src;
  li.innerHTML = `<span>${displayName}</span><span class="meta">${isLocal? 'uploaded' : 'local'}</span>`;
  li.onclick = ()=> loadSong(src, displayName);
  songListEl.appendChild(li);
}

// populate defaults
defaults.forEach(d => addSongEntry(d.name,d.src,false));

// file upload
uploadInput.addEventListener('change', (ev)=>{
  const f = ev.target.files[0];
  if(!f) return;
  const url = URL.createObjectURL(f);
  addSongEntry(f.name, url, true);
  // auto-load the uploaded file
  loadSong(url, f.name);
});

playBtn.addEventListener('click', ()=>{
  if(!current) return;
  if(current.howl.playing()){
    current.howl.pause();
    playBtn.textContent = 'play';
  } else {
    current.howl.play();
    playBtn.textContent = 'pause';
  }
});

function loadSong(src, name){
  stopCurrent();
  nowEl.textContent = `loading: ${name}`;
  // create Howl
  const howl = new Howl({
    src: [src],
    html5: true,
    autoplay: false,
    onplay: () => { playBtn.textContent = 'pause'; nowEl.textContent = `playing: ${name}`; },
    onpause: () => { playBtn.textContent = 'play'; },
    onend: () => { playBtn.textContent = 'play'; nowEl.textContent = `ended: ${name}`; }
  });
  // setup analyser (Web Audio API)
  if(!audioContext){
    audioContext = Howler.ctx; // Howler provides shared context
  }
  const source = Howler._howls.length ? Howler._howls[Howler._howls.length-1] : null;
  // using Howler's internal node is unreliable cross-browser; instead create an analyser from Howler.ctx
  const howlObj = {name, howl};
  current = howlObj;
  // connect analyser to Global Howler master gain
  try{
    if(!analyser){
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      Howler.masterGain.connect(analyser);
    }
  }catch(e){
    console.warn("analyser setup failed", e);
  }
  // start paused (user must click play)
  // autoplay blocked by browsers, so do not call play automatically
  nowEl.textContent = `loaded: ${name} — press play`;
  // keep record
  howls.push(howlObj);
}

// stop any playing Howl
function stopCurrent(){
  howls.forEach(h => h.howl && h.howl.stop());
  if(current && current.howl) current.howl.stop();
  current = null;
  playBtn.textContent = 'play';
  nowEl.textContent = 'no song loaded';
}

///////////// three.js scene /////////////
function initThree(){
  renderer = new THREE.WebGLRenderer({canvas, antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 2000);
  camera.position.set(0, 6, 16);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0,2,0);
  controls.enablePan = false;
  controls.enableDamping = true;
  clock = new THREE.Clock();

  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onKey);
}

function initScene(){
  // fog + ambient
  scene.fog = new THREE.FogExp2(0x050607, 0.02);
  const amb = new THREE.HemisphereLight(0xffffff, 0x222222, 0.6);
  scene.add(amb);

  // floor
  const floorGeo = new THREE.PlaneGeometry(120,120);
  const floorMat = new THREE.MeshStandardMaterial({color:0x0b1116, roughness:0.9, metalness:0});
  floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI/2;
  floor.position.y = 0;
  scene.add(floor);

  // stage
  const stageGeo = new THREE.BoxGeometry(16,1.6,6);
  const stageMat = new THREE.MeshStandardMaterial({color:0x111417, metalness:0.3, roughness:0.2});
  stage = new THREE.Mesh(stageGeo, stageMat);
  stage.position.set(0, 0.8, -6);
  scene.add(stage);

  // led screen (fake)
  const screenGeo = new THREE.PlaneGeometry(9,4);
  const screenMat = new THREE.MeshBasicMaterial({color:0x101019});
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, 3.4, -8.2);
  scene.add(screen);

  // lights - moving spotlights
  for(let i=0;i<6;i++){
    const sp = new THREE.SpotLight(0x7dd3fc, 2, 40, Math.PI/8, 0.2, 1);
    sp.position.set(Math.cos(i/6*Math.PI*2)*8, 10, Math.sin(i/6*Math.PI*2)*8 - 6);
    sp.target = stage;
    scene.add(sp);
    lights.push(sp);
  }

  // avatar (player)
  const avGeo = new THREE.SphereGeometry(0.6, 16, 12);
  const avMat = new THREE.MeshStandardMaterial({color:0xffb86b, metalness:0.3, roughness:0.6});
  avatar = new THREE.Mesh(avGeo,avMat);
  avatar.position.set(0,0.6,3);
  scene.add(avatar);

  // crowd (simple boxes)
  for(let i=-12;i<=12;i+=2){
    for(let j=4;j<=18;j+=2.5){
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, Math.random()*1.4+0.2, 0.6),
        new THREE.MeshStandardMaterial({color:0x162028}));
      box.position.set(i + (Math.random()-0.5)*0.4, (box.geometry.parameters.height/2), j - 6);
      scene.add(box);
    }
  }

  // particles for beat (will update)
  const partGeo = new THREE.BufferGeometry();
  const count = 120;
  const pos = new Float32Array(count*3);
  for(let i=0;i<count;i++){
    pos[i*3+0] = (Math.random()-0.5)*40;
    pos[i*3+1] = Math.random()*6 + 1;
    pos[i*3+2] = (Math.random()-0.5)*30 - 6;
  }
  partGeo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const partMat = new THREE.PointsMaterial({size:0.16, transparent:true});
  const particles = new THREE.Points(partGeo, partMat);
  scene.add(particles);
  scene.userData.particles = particles;

  // subtle ambient stage glow
  const glow = new THREE.Mesh(new THREE.ConeGeometry(9, 18, 32, 1, true), new THREE.MeshBasicMaterial({color:0x7dd3fc, transparent:true, opacity:0.035, side:THREE.DoubleSide}));
  glow.position.set(0,6,-6);
  scene.add(glow);
}

let move = {forward:0,right:0};
function onKey(e){
  if(e.key==='w') move.forward = 1;
  if(e.key==='s') move.forward = -1;
  if(e.key==='a') move.right = -1;
  if(e.key==='d') move.right = 1;
  // keyup listener:
  window.addEventListener('keyup', (ev)=>{
    if(ev.key==='w' || ev.key==='s') move.forward = 0;
    if(ev.key==='a' || ev.key==='d') move.right = 0;
  }, {once:true});
}

function animate(){
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  // avatar movement
  const speed = 6;
  avatar.position.x += move.right * speed * dt;
  avatar.position.z -= move.forward * speed * dt;
  avatar.position.x = THREE.MathUtils.clamp(avatar.position.x, -30, 30);
  avatar.position.z = THREE.MathUtils.clamp(avatar.position.z, -20, 20);

  // camera follows avatar a bit
  camera.position.lerp(new THREE.Vector3(avatar.position.x, avatar.position.y + 6.5, avatar.position.z + 12), 0.08);
  controls.target.lerp(new THREE.Vector3(avatar.position.x, avatar.position.y+2, avatar.position.z), 0.08);
  controls.update();

  // move spotlights slowly and modulate intensity with audio analyser
  const t = performance.now() * 0.001;
  scene.userData.particles.material.size = 0.12 + Math.sin(t*2)*0.06;

  if(analyser && current && current.howl && current.howl.playing()){
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    // compute low/mid energy
    const low = avgRange(data, 0, 6) / 255;
    const mid = avgRange(data, 6, 20) / 255;
    // pulse stage lights
    lights.forEach((l,i)=>{
      l.intensity = 1.2 + low*6 + Math.abs(Math.sin(t + i))*0.4;
      l.angle = Math.PI/16 + (mid*0.06);
      l.color.setHSL(0.55 + (i/6)*0.08, 0.8, 0.5 + low*0.25);
    });
    // particle scale to bass
    scene.userData.particles.scale.y = 1 + low*1.8;
    scene.userData.particles.material.size = 0.06 + mid*0.2;
  } else {
    lights.forEach((l,i)=>{
      l.intensity = 0.8 + Math.abs(Math.sin(t + i))*0.2;
    });
  }

  renderer.render(scene, camera);
}

// utility: average range of analyser data
function avgRange(array, i0, i1){
  let sum=0,c=0;
  for(let i=i0;i<i1 && i<array.length;i++){ sum += array[i]; c++; }
  return c? sum/c : 0;
}

function onResize(){
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
