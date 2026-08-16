(function () {
    const host = document.querySelector('.overview');
    const canvas = document.getElementById('workshop-scene');
    if (!host || !canvas || !window.THREE) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(44, 1, .1, 160);
    camera.position.set(0, 1.4, coarsePointer ? 34 : 27);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    canvas.dataset.renderer = 'three-webgl';

    const controls = new THREE.OrbitControls(camera, canvas);
    controls.enabled = !coarsePointer;
    controls.enableDamping = !reducedMotion;
    controls.dampingFactor = .07;
    controls.enablePan = false;
    controls.minDistance = 18;
    controls.maxDistance = 42;
    controls.rotateSpeed = .48;

    scene.add(new THREE.AmbientLight(0xd9fffa, .72));
    const key = new THREE.PointLight(0x29a79b, 1.1, 80);
    key.position.set(7, 8, 12);
    scene.add(key);
    const rim = new THREE.PointLight(0xe8ad55, .82, 70);
    rim.position.set(-10, -5, 4);
    scene.add(rim);

    const projectGroup = new THREE.Group();
    projectGroup.position.x = 1.4;
    scene.add(projectGroup);
    const palette = [0x087b78, 0xcf5d52, 0xc77a17, 0x3b82a0, 0x238155, 0x71649a];
    const positions = [
        [-7.2, 3.4, -1.8], [-2.8, -3.8, 2.3], [2.2, 4.2, -2.5],
        [7.1, 1.2, 1.6], [4.7, -4.4, -1.2], [-.2, .3, 3.8],
    ];
    const geometryFactories = [
        () => new THREE.IcosahedronGeometry(1.05, 1),
        () => new THREE.TorusKnotGeometry(.72, .22, 72, 10),
        () => new THREE.OctahedronGeometry(1.08, 0),
        () => new THREE.DodecahedronGeometry(1.02, 0),
        () => new THREE.TorusGeometry(.82, .27, 12, 48),
        () => new THREE.BoxGeometry(1.55, 1.55, 1.55),
    ];
    const nodes = positions.map((position, index) => {
        const color = new THREE.Color(palette[index]);
        const mesh = new THREE.Mesh(
            geometryFactories[index](),
            new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: .18, shininess: 90, flatShading: index !== 1 })
        );
        mesh.position.set(...position);
        mesh.userData.phase = index * .9;
        projectGroup.add(mesh);
        const halo = new THREE.Mesh(
            new THREE.TorusGeometry(1.45, .025, 5, 64),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .28 })
        );
        halo.position.copy(mesh.position);
        halo.rotation.set(index * .31, index * .52, index * .23);
        halo.userData.phase = index * .7;
        projectGroup.add(halo);
        return { mesh, halo };
    });

    const linkVertices = [];
    const links = [[0, 2], [0, 5], [1, 4], [1, 5], [2, 3], [2, 5], [3, 4], [4, 5]];
    links.forEach(([source, target]) => {
        linkVertices.push(...positions[source], ...positions[target]);
    });
    const linkGeometry = new THREE.BufferGeometry();
    linkGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linkVertices, 3));
    projectGroup.add(new THREE.LineSegments(linkGeometry, new THREE.LineBasicMaterial({
        color: 0x087b78, transparent: true, opacity: .22,
    })));

    const dustCount = coarsePointer ? 90 : 180;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let index = 0; index < dustCount; index += 1) {
        dustPositions[index * 3] = (Math.random() - .5) * 28;
        dustPositions[index * 3 + 1] = (Math.random() - .5) * 15;
        dustPositions[index * 3 + 2] = (Math.random() - .5) * 16;
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({
        color: 0x1b8e88, size: .08, transparent: true, opacity: .38, depthWrite: false,
    }));
    projectGroup.add(dust);

    let visible = true;
    let lastTime = performance.now();
    function resize() {
        const bounds = host.getBoundingClientRect();
        const width = Math.max(1, bounds.width);
        const height = Math.max(1, bounds.height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
    }

    function animate(time) {
        requestAnimationFrame(animate);
        const delta = Math.min(.05, (time - lastTime) / 1000);
        lastTime = time;
        if (!visible || document.hidden) return;
        controls.update();
        if (!reducedMotion) {
            projectGroup.rotation.y += delta * .055;
            projectGroup.rotation.x = Math.sin(time * .00016) * .055;
            dust.rotation.y -= delta * .018;
            nodes.forEach(({ mesh, halo }, index) => {
                mesh.rotation.x += delta * (.12 + index * .018);
                mesh.rotation.y += delta * (.16 + index * .012);
                mesh.position.y = positions[index][1] + Math.sin(time * .0012 + mesh.userData.phase) * .16;
                halo.position.y = mesh.position.y;
                halo.rotation.z += delta * (.08 + index * .012);
            });
        }
        renderer.render(scene, camera);
    }

    new IntersectionObserver(entries => {
        visible = entries[0]?.isIntersecting ?? true;
    }, { threshold: .05 }).observe(host);
    new ResizeObserver(resize).observe(host);
    resize();
    animate(performance.now());
})();
