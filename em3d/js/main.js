// 引入 Three.js 核心库和鼠标控制器
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Vector3 as MathVec3 } from './math.js';
import { Particle } from './particle.js';

const API_ROOT = ['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://127.0.0.1:8090/api/v1' : '/api/v1';
const CLIENT_KEY = 'lyf_lab_client_id';
function clientId() {
    let value = localStorage.getItem(CLIENT_KEY);
    if (!/^[0-9a-f-]{36}$/i.test(value || '')) {
        value = crypto.randomUUID();
        localStorage.setItem(CLIENT_KEY, value);
    }
    return value;
}
async function api(path, options = {}) {
    const response = await fetch(API_ROOT + path, {
        credentials: 'include',
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.status === 204 ? null : response.json();
}

// ==========================================
// --- 1. 基础场景与摄像机 ---
// ==========================================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(20, 20, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const axesHelper = new THREE.AxesHelper(10);
scene.add(axesHelper);
const gridHelper = new THREE.GridHelper(30, 30, 0x444444, 0x222222);
scene.add(gridHelper);

// ==========================================
// --- 2. 粒子与发光轨迹设置 ---
// ==========================================
const particleMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ffcc })
);
scene.add(particleMesh);

const maxTrailPoints = 1000;
const trailGeometry = new THREE.BufferGeometry();
const trailPositions = new Float32Array(maxTrailPoints * 3);
trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
const trailMaterial = new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.6 });
const trailLine = new THREE.Line(trailGeometry, trailMaterial);
scene.add(trailLine);

let trailCount = 0;

// ==========================================
// --- 3. 物理引擎初始化 ---
// ==========================================
let E_field = new MathVec3(0, 0.1, 0); // 初始电场 0.1 V/m
let B_field = new MathVec3(0, -5.0, 0); // 初始磁场 -5.0 T
let initialSpeed = 5;
let myParticle = new Particle(1, 1, new MathVec3(0, 0, 0), new MathVec3(initialSpeed, 0, 0));

// ==========================================
// --- 4. 场线可视化矢量箭头 ---
// ==========================================
const bArrows = [];
const eArrows = [];
const gridRange = 10;
const step = 5;

// 在网格上生成场线箭头阵列
for(let x = -gridRange; x <= gridRange; x += step) {
    for(let z = -gridRange; z <= gridRange; z += step) {
        const origin = new THREE.Vector3(x, 0, z);
        
        // 磁场 B 箭头 (青蓝色)
        const bArrow = new THREE.ArrowHelper(new THREE.Vector3(0,1,0), origin, 1, 0x00aaff, 0.6, 0.4);
        bArrow.line.material.transparent = true; bArrow.line.material.opacity = 0.3;
        bArrow.cone.material.transparent = true; bArrow.cone.material.opacity = 0.5;
        scene.add(bArrow);
        bArrows.push(bArrow);

        // 电场 E 箭头 (橙黄色)
        const eArrow = new THREE.ArrowHelper(new THREE.Vector3(0,1,0), origin, 1, 0xffaa00, 0.6, 0.4);
        eArrow.line.material.transparent = true; eArrow.line.material.opacity = 0.3;
        eArrow.cone.material.transparent = true; eArrow.cone.material.opacity = 0.5;
        scene.add(eArrow);
        eArrows.push(eArrow);
    }
}

function updateFieldArrows() {
    const bVal = B_field.y;
    bArrows.forEach(arrow => {
        if (Math.abs(bVal) < 0.1) { arrow.visible = false; } 
        else {
            arrow.visible = true;
            arrow.setDirection(new THREE.Vector3(0, bVal >= 0 ? 1 : -1, 0));
            arrow.setLength(Math.abs(bVal) * 1.0, 0.6, 0.4); 
        }
    });

    const eVal = E_field.y;
    eArrows.forEach(arrow => {
        if (Math.abs(eVal) < 0.05) { arrow.visible = false; } 
        else {
            arrow.visible = true;
            arrow.setDirection(new THREE.Vector3(0, eVal >= 0 ? 1 : -1, 0));
            arrow.setLength(Math.abs(eVal) * 5.0, 0.6, 0.4); 
        }
    });
}
updateFieldArrows(); // 初始化调用一次

// ==========================================
// --- 5. ECharts 动态图表逻辑 ---
// ==========================================
const chartDom = document.getElementById('chart-panel');
const myChart = echarts.init(chartDom, 'dark');

let timeData = [];
let kineticEnergyData = [];
let simTime = 0;

myChart.setOption({
    backgroundColor: 'transparent',
    title: { text: '实时动能 (Kinetic Energy)', textStyle: { color: '#00ffcc', fontSize: 14 }, left: 'center' },
    grid: { left: 40, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: timeData, axisLabel: { show: false } },
    yAxis: { type: 'value', name: 'Ek (J)', splitLine: { lineStyle: { color: '#333', type: 'dashed' } }, min: 'dataMin' },
    series: [{
        data: kineticEnergyData, type: 'line', smooth: true, showSymbol: false,
        lineStyle: { color: '#00ffcc', width: 2 },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(0, 255, 204, 0.5)' }, { offset: 1, color: 'rgba(0, 255, 204, 0.0)' }]) }
    }]
});

function updateChart(dt) {
    simTime += dt;
    const v = myParticle.v;
    const Ek = 0.5 * myParticle.m * (v.x * v.x + v.y * v.y + v.z * v.z);

    timeData.push(simTime.toFixed(2));
    kineticEnergyData.push(Ek.toFixed(3));
    if (timeData.length > 150) { timeData.shift(); kineticEnergyData.shift(); }

    myChart.setOption({ xAxis: { data: timeData }, series: [{ data: kineticEnergyData }] });
}

// ==========================================
// --- 6. 绑定 UI 控制面板 ---
// ==========================================
const bSlider = document.getElementById('b-slider');
const bVal = document.getElementById('b-val');
const eSlider = document.getElementById('e-slider');
const eVal = document.getElementById('e-val');
const resetBtn = document.getElementById('reset-btn');

bSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    bVal.innerText = val.toFixed(1);
    B_field.y = val; 
    updateFieldArrows(); // 联动场线箭头
});

eSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    eVal.innerText = val.toFixed(1);
    E_field.y = val; 
    updateFieldArrows(); // 联动场线箭头
});

resetBtn.addEventListener('click', () => {
    myParticle.p = new MathVec3(0, 0, 0);
    myParticle.v = new MathVec3(initialSpeed, 0, 0);
    trailCount = 0; // 清空 3D 轨迹
    timeData = [];  // 清空图表数据
    kineticEnergyData = [];
    simTime = 0;
});

// ==========================================
// --- 7. 动画主循环 (唯一且干净的 Loop) ---
// ==========================================
const clock = new THREE.Clock();
let frameCount = 0; 

function animate() {
    requestAnimationFrame(animate);
    controls.update(); 

    let dt = clock.getDelta();
    if (dt > 0.1) dt = 0.1; 

    // 1. 物理步进
    myParticle.update(dt, E_field, B_field);
    particleMesh.position.set(myParticle.p.x, myParticle.p.y, myParticle.p.z);

    // 2. 轨迹更新
    if (trailCount < maxTrailPoints) {
        trailPositions[trailCount * 3] = myParticle.p.x;
        trailPositions[trailCount * 3 + 1] = myParticle.p.y;
        trailPositions[trailCount * 3 + 2] = myParticle.p.z;
        trailCount++;
        trailGeometry.setDrawRange(0, trailCount);
        trailGeometry.attributes.position.needsUpdate = true;
    } else {
        for (let i = 0; i < maxTrailPoints - 1; i++) {
            trailPositions[i * 3] = trailPositions[(i + 1) * 3];
            trailPositions[i * 3 + 1] = trailPositions[(i + 1) * 3 + 1];
            trailPositions[i * 3 + 2] = trailPositions[(i + 1) * 3 + 2];
        }
        trailPositions[(maxTrailPoints - 1) * 3] = myParticle.p.x;
        trailPositions[(maxTrailPoints - 1) * 3 + 1] = myParticle.p.y;
        trailPositions[(maxTrailPoints - 1) * 3 + 2] = myParticle.p.z;
        trailGeometry.attributes.position.needsUpdate = true;
    }

    // 3. 图表更新
    frameCount++;
    if (frameCount % 3 === 0) { updateChart(dt); }

    renderer.render(scene, camera);
}

animate();

const presetSelect = document.getElementById('preset-select');
const saveRunButton = document.getElementById('save-run-btn');
const syncState = document.getElementById('sync-state');
const runList = document.getElementById('run-list');

function applyParameters(parameters) {
    B_field.y = Number(parameters.magnetic_field ?? B_field.y);
    E_field.y = Number(parameters.electric_field ?? E_field.y);
    initialSpeed = Number(parameters.velocity ?? initialSpeed);
    bSlider.value = String(B_field.y);
    eSlider.value = String(E_field.y);
    bVal.innerText = B_field.y.toFixed(1);
    eVal.innerText = E_field.y.toFixed(1);
    updateFieldArrows();
    resetBtn.click();
}

async function loadPresets() {
    try {
        const data = await api(`/lab/presets?client_id=${clientId()}&experiment=electromagnetic-particle`);
        data.items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.name;
            option.dataset.parameters = JSON.stringify(item.parameters);
            presetSelect.appendChild(option);
        });
        presetSelect.addEventListener('change', () => {
            const raw = presetSelect.selectedOptions[0]?.dataset.parameters;
            if (raw) applyParameters(JSON.parse(raw));
        });
        syncState.textContent = '实验数据服务在线';
    } catch (error) {
        syncState.textContent = '本地模式：预设服务暂不可用';
    }
}

function renderRuns(items) {
    if (!items.length) {
        runList.innerHTML = '<p class="empty-run">暂无实验记录</p>';
        return;
    }
    runList.innerHTML = items.map(item => `<article class="run-item" data-parameters='${JSON.stringify(item.parameters)}'><strong>B ${item.parameters.magnetic_field} T / E ${item.parameters.electric_field} V·m⁻¹</strong>${item.results.final_speed} m·s⁻¹ · ${item.results.trail_points} points<br>${new Date(item.created_at).toLocaleString('zh-CN', { hour12: false })}</article>`).join('');
    runList.querySelectorAll('.run-item').forEach(item => {
        item.addEventListener('click', () => applyParameters(JSON.parse(item.dataset.parameters)));
    });
}

async function loadRuns() {
    try {
        const data = await api(`/lab/runs?client_id=${clientId()}&experiment=electromagnetic-particle`);
        renderRuns(data.items);
    } catch (error) {
        runList.innerHTML = '<p class="empty-run">历史记录暂不可用</p>';
    }
}

saveRunButton.addEventListener('click', async () => {
    const speed = Math.hypot(myParticle.v.x, myParticle.v.y, myParticle.v.z);
    const energy = .5 * myParticle.m * speed * speed;
    saveRunButton.disabled = true;
    syncState.textContent = '正在保存实验快照';
    try {
        await api('/lab/runs', {
            method: 'POST',
            body: JSON.stringify({
                client_id: clientId(),
                experiment: 'electromagnetic-particle',
                parameters: { magnetic_field: B_field.y, electric_field: E_field.y, velocity: initialSpeed, charge: myParticle.q, mass: myParticle.m },
                results: { duration: Number(simTime.toFixed(3)), final_speed: Number(speed.toFixed(4)), kinetic_energy: Number(energy.toFixed(4)), trail_points: trailCount, final_x: Number(myParticle.p.x.toFixed(4)), final_y: Number(myParticle.p.y.toFixed(4)), final_z: Number(myParticle.p.z.toFixed(4)) },
                notes: '',
            }),
        });
        syncState.textContent = '实验记录已保存';
        await loadRuns();
    } catch (error) {
        syncState.textContent = '保存失败，请检查后端连接';
    } finally {
        saveRunButton.disabled = false;
    }
});

loadPresets();
loadRuns();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
