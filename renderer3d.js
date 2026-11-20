(() => {
  "use strict";

  const THREE = window.THREE;
  if (!THREE) {
    console.error("Three.js did not load; the 3D renderer is unavailable.");
    return;
  }

  function create(canvas, route, buildings) {
    const mobile = window.matchMedia("(pointer: coarse), (max-width: 760px)").matches;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !mobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x111a2b, 650, 2500);
    const camera = new THREE.PerspectiveCamera(67, 1, .1, 4200);
    const hemi = new THREE.HemisphereLight(0x9bbbe8, 0x171d24, .72);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0x9fbaff, .72);
    sun.position.set(-600, 1100, -250);
    sun.castShadow = !mobile;
    sun.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
    sun.shadow.camera.left = -1200;
    sun.shadow.camera.right = 1200;
    sun.shadow.camera.top = 1200;
    sun.shadow.camera.bottom = -1200;
    scene.add(sun);
    scene.add(sun.target);

    scene.add(camera);
    const temporalUniforms = {
      uTime: { value: 0 },
      uMotion: { value: 0 },
      uBoost: { value: 0 },
      uHeat: { value: 0 }
    };
    const temporalOverlay = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: temporalUniforms,
        vertexShader: "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader: `
          varying vec2 vUv;
          uniform float uTime;
          uniform float uMotion;
          uniform float uBoost;
          uniform float uHeat;
          void main() {
            vec2 centered = vUv - 0.5;
            float radius = length(centered);
            float angle = atan(centered.y, centered.x);
            float edge = smoothstep(0.10, 0.74, radius);
            float spokes = pow(max(0.0, sin(angle * 23.0 + radius * 9.0 - uTime * 1.8)), 18.0);
            float filaments = pow(max(0.0, sin(angle * 39.0 - radius * 17.0 + uTime * 1.15)), 28.0);
            float ring = pow(max(0.0, 1.0 - abs(fract(radius * 4.4 - uTime * 0.24) - 0.5) * 7.0), 2.0);
            float energy = clamp(uMotion * 0.9 + uBoost * 0.8 + uHeat * 0.16, 0.0, 1.0);
            float alpha = edge * (spokes * 0.22 + filaments * 0.1 + ring * 0.17) * energy;
            vec3 teal = vec3(0.16, 0.92, 0.77);
            vec3 pink = vec3(0.96, 0.28, 0.67);
            vec3 color = mix(teal, pink, 0.5 + 0.5 * sin(angle * 2.0 + uTime * 0.7));
            gl_FragColor = vec4(color, alpha);
          }
        `
      })
    );
    const temporalOverlayDistance = .7;
    temporalOverlay.position.z = -temporalOverlayDistance;
    temporalOverlay.renderOrder = 1000;
    camera.add(temporalOverlay);
    const speedLineCount = 18;
    const speedLinePositions = new Float32Array(speedLineCount * 2 * 3);
    const speedLineGeometry = new THREE.BufferGeometry();
    speedLineGeometry.setAttribute("position", new THREE.BufferAttribute(speedLinePositions, 3));
    speedLineGeometry.setDrawRange(0, 0);
    const speedLines = new THREE.LineSegments(speedLineGeometry, new THREE.LineBasicMaterial({
      color: 0xb9fff5, transparent: true, opacity: 0, depthTest: false, depthWrite: false
    }));
    speedLines.position.z = -temporalOverlayDistance + .035;
    speedLines.renderOrder = 1001;
    camera.add(speedLines);
    for (const side of [-1, 1]) {
      const headlight = new THREE.SpotLight(0xd7e6ff, 6, 230, Math.PI / 7, .62, 1.5);
      headlight.position.set(side * 1.15, -.4, -2.4);
      headlight.target.position.set(0, -4, -170);
      camera.add(headlight, headlight.target);
    }
    const cockpit = new THREE.Group();
    camera.add(cockpit);
    const cockpitPaint = new THREE.MeshPhysicalMaterial({
      color: 0x9b3b76, metalness: .48, roughness: .3, clearcoat: .9, clearcoatRoughness: .19
    });
    const dashboardMaterial = new THREE.MeshStandardMaterial({ color: 0x101722, metalness: .18, roughness: .68 });
    const hood = new THREE.Mesh(new THREE.BoxGeometry(5, .35, 3.5), cockpitPaint);
    hood.position.set(0, -6.5, -19);
    cockpit.add(hood);
    const dashboard = new THREE.Mesh(new THREE.BoxGeometry(5, .45, 1.1), dashboardMaterial);
    dashboard.position.set(0, -1.8, -3.5);
    cockpit.add(dashboard);
    const steeringWheel = new THREE.Mesh(
      new THREE.TorusGeometry(.42, .075, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x18202b, metalness: .35, roughness: .42 })
    );
    steeringWheel.position.set(0, -1.55, -3.3);
    steeringWheel.rotation.x = .18;
    cockpit.add(steeringWheel);

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(3900, 24, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: "varying vec3 vNormal; void main(){vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader: "varying vec3 vNormal; void main(){float h=max(normalize(vNormal).y,0.0);vec3 horizon=vec3(0.23,0.17,0.34);vec3 high=vec3(0.018,0.035,0.085);gl_FragColor=vec4(mix(horizon,high,smoothstep(0.02,0.72,h)),1.0);}"
      })
    );
    scene.add(sky);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(5200, 4200), new THREE.MeshStandardMaterial({ color: 0x202c2b, roughness: .94 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(1200, -.5, 900);
    ground.receiveShadow = true;
    scene.add(ground);
    const asphaltCanvas = document.createElement("canvas");
    asphaltCanvas.width = 128; asphaltCanvas.height = 128;
    const asphaltContext = asphaltCanvas.getContext("2d");
    const asphaltPixels = asphaltContext.createImageData(128, 128);
    let asphaltSeed = 69173;
    for (let i = 0; i < asphaltPixels.data.length; i += 4) {
      asphaltSeed = (asphaltSeed * 1664525 + 1013904223) >>> 0;
      const grain = 118 + (asphaltSeed >>> 28);
      asphaltPixels.data[i] = grain;
      asphaltPixels.data[i + 1] = grain + 2;
      asphaltPixels.data[i + 2] = grain + 6;
      asphaltPixels.data[i + 3] = 255;
    }
    asphaltContext.putImageData(asphaltPixels, 0, 0);
    const asphaltTexture = new THREE.CanvasTexture(asphaltCanvas);
    asphaltTexture.colorSpace = THREE.SRGBColorSpace;
    asphaltTexture.wrapS = asphaltTexture.wrapT = THREE.RepeatWrapping;
    asphaltTexture.repeat.set(1, 1);
    const roadMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x9ca9b7, map: asphaltTexture, roughness: .82, metalness: .025, clearcoat: .06, clearcoatRoughness: .55,
      side: THREE.DoubleSide
    });
    const curbMaterial = new THREE.MeshStandardMaterial({ color: 0x938a92, roughness: .72, side: THREE.DoubleSide });
    const addRibbon = (inner, outer, material, y) => {
      const positions = [], indices = [], uvs = [], count = 320;
      for (let i = 0; i <= count; i++) {
        const t = i / count * route.length;
        const p = routePoint(t), before = routePoint(t - .002), after = routePoint(t + .002);
        const angle = Math.atan2(after.y - before.y, after.x - before.x);
        const nx = -Math.sin(angle), nz = Math.cos(angle);
        positions.push(p.x + nx * inner, y, p.y + nz * inner);
        positions.push(p.x + nx * outer, y, p.y + nz * outer);
        uvs.push(i / count * 18, 0, i / count * 18, 1);
      }
      for (let i = 0; i < count; i++) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };
    addRibbon(-137, 137, roadMaterial, .08);
    addRibbon(137, 146, curbMaterial, .12);
    addRibbon(-146, -137, curbMaterial, .12);

    const dashMaterial = new THREE.MeshStandardMaterial({ color: 0xd8d5d0, roughness: .5, metalness: .05 });
    for (let i = 0; i < 80; i++) {
      if (i < 3 || i % 3 === 1) continue;
      const t = i / 80 * route.length;
      const point = routePoint(t), next = routePoint(t + .006);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(5, .2, 31), dashMaterial);
      mark.position.set(point.x, .28, point.y);
      mark.rotation.y = Math.PI / 2 - Math.atan2(next.y - point.y, next.x - point.x);
      scene.add(mark);
    }

    const flowerColors = [0xff77c5, 0xf6df72, 0xa39aff, 0xffaa73, 0xf0f0d7];
    const flowerMaterials = flowerColors.map(color => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .08, roughness: .72 }));
    const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x557852, roughness: .92 });
    const flowerGeo = new THREE.SphereGeometry(1, 7, 5);
    const stemGeo = new THREE.CylinderGeometry(.13, .18, 5, 5);
    const flowerInstances = flowerMaterials.map(material => {
      const mesh = new THREE.InstancedMesh(flowerGeo, material, 2800);
      mesh.count = 0;
      scene.add(mesh);
      return mesh;
    });
    const stemInstances = new THREE.InstancedMesh(stemGeo, stemMaterial, 600);
    const heartInstances = new THREE.InstancedMesh(flowerGeo, new THREE.MeshStandardMaterial({ color: 0xffed9a, roughness: .48 }), 600);
    stemInstances.count = 0;
    heartInstances.count = 0;
    scene.add(stemInstances, heartInstances);
    const flowerTransform = new THREE.Object3D();
    function plantFlower(x, z, size, colorIndex) {
      flowerTransform.position.set(x, 2.5 * size, z);
      flowerTransform.rotation.set(0, 0, 0);
      flowerTransform.scale.setScalar(size);
      flowerTransform.updateMatrix();
      stemInstances.setMatrixAt(stemInstances.count++, flowerTransform.matrix);
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 2 / 5;
        flowerTransform.position.set(x + Math.cos(angle) * 1.25 * size, 5.3 * size, z + Math.sin(angle) * 1.25 * size);
        flowerTransform.scale.set(.9 * size, .45 * size, .68 * size);
        flowerTransform.updateMatrix();
        const instances = flowerInstances[((colorIndex % flowerMaterials.length) + flowerMaterials.length) % flowerMaterials.length];
        instances.setMatrixAt(instances.count++, flowerTransform.matrix);
      }
      flowerTransform.position.set(x, 5.35 * size, z);
      flowerTransform.scale.set(.48 * size, .4 * size, .48 * size);
      flowerTransform.updateMatrix();
      heartInstances.setMatrixAt(heartInstances.count++, flowerTransform.matrix);
    }

    const buildingMaterials = [
      0x31d8bf, 0xf05a9e, 0x856bfa, 0xff973f, 0x43aef5, 0x8bc943, 0xf2675b
    ].map(color => new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: .11, roughness: .72, metalness: .08
    }));
    const roofMaterials = [0x182b48, 0x183a3b, 0x332448, 0x40301d].map(color =>
      new THREE.MeshStandardMaterial({ color, roughness: .68, metalness: .22 })
    );
    const facadeAccentColors = [0x5fffe1, 0xff70bc, 0xffcf68, 0x9d8aff, 0x68baff];
    const facadeAccentMaterials = facadeAccentColors.map(color =>
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.1, roughness: .3 })
    );
    const windowMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x8fffea, emissive: 0x32d4b8, emissiveIntensity: 1.25, roughness: .34 }),
      new THREE.MeshStandardMaterial({ color: 0xffacd8, emissive: 0xe94e9c, emissiveIntensity: 1.2, roughness: .34 }),
      new THREE.MeshStandardMaterial({ color: 0xffdf8d, emissive: 0xf3a936, emissiveIntensity: 1.15, roughness: .38 }),
      new THREE.MeshStandardMaterial({ color: 0xb9aaff, emissive: 0x7758f4, emissiveIntensity: 1.25, roughness: .34 }),
      new THREE.MeshStandardMaterial({ color: 0x9dd5ff, emissive: 0x419cf2, emissiveIntensity: 1.2, roughness: .34 })
    ];
    const windowGeo = new THREE.BoxGeometry(4.5, 7, .8);
    const windowInstances = windowMaterials.map(material => {
      const mesh = new THREE.InstancedMesh(windowGeo, material, 1200);
      mesh.count = 0;
      scene.add(mesh);
      return mesh;
    });
    const windowTransform = new THREE.Object3D();
    const isCloseToRoad = (x, z, radius) => {
      for (let i = 0; i < route.length * 24; i++) {
        const point = routePoint(i / 24);
        if (Math.hypot(point.x - x, point.y - z) < radius) return true;
      }
      return false;
    };
    buildings.forEach((building, index) => {
      const x = building.x + building.w / 2, z = building.y + building.h / 2;
      if (isCloseToRoad(x, z, Math.max(building.w, building.h) * .46 + 142)) return;
      const height = 48 + (building.seed % 61);
      const body = new THREE.Mesh(new THREE.BoxGeometry(building.w, height, building.h), buildingMaterials[index % buildingMaterials.length]);
      body.position.set(x, height / 2, z);
      body.castShadow = true;
      body.receiveShadow = true;
      scene.add(body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(building.w + 8, 4, building.h + 8), roofMaterials[index % roofMaterials.length]);
      roof.position.set(x, height + 2, z);
      roof.castShadow = true;
      scene.add(roof);

      const rows = Math.max(2, Math.floor(height / 16));
      for (let row = 0; row < rows; row++) {
        const wy = 8 + row * 15;
        for (let col = 0; col < 3; col++) {
          const wx = x - building.w * .28 + col * building.w * .28;
          const frontIndex = (row * 2 + col + index) % windowMaterials.length;
          windowTransform.position.set(wx, wy, z + building.h / 2 + .5);
          windowTransform.rotation.set(0, 0, 0);
          windowTransform.updateMatrix();
          windowInstances[frontIndex].setMatrixAt(windowInstances[frontIndex].count++, windowTransform.matrix);
          const sideIndex = (row + col * 2 + index + 2) % windowMaterials.length;
          windowTransform.position.set(x + building.w / 2 + .5, wy, z - building.h * .24 + col * building.h * .24);
          windowTransform.rotation.y = Math.PI / 2;
          windowTransform.updateMatrix();
          windowInstances[sideIndex].setMatrixAt(windowInstances[sideIndex].count++, windowTransform.matrix);
        }
      }

      for (let i = 0; i < 3; i++) {
        plantFlower(building.x + 18 + i * (building.w - 36) / 2, building.y + building.h + 14, .8 + (i % 2) * .2, index + i);
        plantFlower(building.x + 18 + i * (building.w - 36) / 2, building.y - 14, .75, index + i + 2);
      }
      if (index % 4 === 0) {
        const signCanvas = document.createElement("canvas");
        signCanvas.width = 512; signCanvas.height = 144;
        const signContext = signCanvas.getContext("2d");
        signContext.fillStyle = "#182536";
        signContext.fillRect(0, 0, 512, 144);
        signContext.strokeStyle = "#6cf4db";
        signContext.lineWidth = 8;
        signContext.strokeRect(6, 6, 500, 132);
        signContext.fillStyle = index % 8 ? "#ff9bd0" : "#7ff8e0";
        signContext.font = "800 54px sans-serif";
        signContext.textAlign = "center"; signContext.textBaseline = "middle";
        signContext.fillText(["BLOOM CLUB", "NOVA", "PETAL LAB", "SKYGARDEN"][index % 4], 256, 72);
        const signTexture = new THREE.CanvasTexture(signCanvas);
        signTexture.colorSpace = THREE.SRGBColorSpace;
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(34, 10), new THREE.MeshBasicMaterial({ map: signTexture, side: THREE.DoubleSide }));
        sign.position.set(x, height * .58, z + building.h / 2 + 1);
        scene.add(sign);
      }

    });
    for (let i = 0; i < route.length * 2; i++) {
      const t = i / 2, point = routePoint(t);
      const before = routePoint(t - .01), after = routePoint(t + .01);
      const angle = Math.atan2(after.y - before.y, after.x - before.x);
      const side = i % 2 ? 1 : -1;
      const offset = 220 + (i % 3) * 32;
      const width = 94 + (i % 3) * 14, depth = 82 + (i % 4) * 13;
      const height = 72 + (i * 19) % 70;
      const tower = new THREE.Group();
      tower.position.set(point.x - Math.sin(angle) * offset * side, 0, point.y + Math.cos(angle) * offset * side);
      tower.rotation.y = -angle;
      const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), buildingMaterials[(i + 2) % buildingMaterials.length]);
      body.position.y = height / 2;
      body.castShadow = true; body.receiveShadow = true;
      tower.add(body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(width + 8, 4, depth + 8), roofMaterials[i % roofMaterials.length]);
      roof.position.y = height + 2;
      tower.add(roof);
      const accentColorIndex = (i * 3 + 1) % facadeAccentMaterials.length;
      const crown = new THREE.Mesh(
        new THREE.BoxGeometry(width + 1, 2.1, 1.1),
        facadeAccentMaterials[accentColorIndex]
      );
      crown.position.set(0, height * .78, -side * (depth / 2 + .65));
      tower.add(crown);
      const verticalAccent = new THREE.Mesh(
        new THREE.BoxGeometry(2, height * .46, .9),
        facadeAccentMaterials[(accentColorIndex + 2) % facadeAccentMaterials.length]
      );
      verticalAccent.position.set(width * .36, height * .27, -side * (depth / 2 + .6));
      tower.add(verticalAccent);
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
          const window = new THREE.Mesh(windowGeo, windowMaterials[(row * 2 + col + i) % windowMaterials.length]);
          window.position.set(-width * .3 + col * width * .3, 13 + row * 14, -side * (depth / 2 + .6));
          window.rotation.y = side === 1 ? Math.PI : 0;
          tower.add(window);
        }
      }
      const adCanvas = document.createElement("canvas");
      adCanvas.width = 512; adCanvas.height = 144;
      const adContext = adCanvas.getContext("2d");
      adContext.fillStyle = "#182536"; adContext.fillRect(0, 0, 512, 144);
      adContext.strokeStyle = i % 2 ? "#ff83c8" : "#6cf4db"; adContext.lineWidth = 8; adContext.strokeRect(6, 6, 500, 132);
      adContext.fillStyle = "#f4fbff"; adContext.font = "800 49px sans-serif";
      adContext.textAlign = "center"; adContext.textBaseline = "middle";
      adContext.fillText(["NOVA", "ASTER", "BLOOM CLUB", "SKYGARDEN"][i % 4], 256, 72);
      const adTexture = new THREE.CanvasTexture(adCanvas);
      adTexture.colorSpace = THREE.SRGBColorSpace;
      const ad = new THREE.Mesh(new THREE.PlaneGeometry(43, 12), new THREE.MeshBasicMaterial({ map: adTexture, side: THREE.DoubleSide }));
      ad.position.set(0, height * .58, -side * (depth / 2 + 1.2));
      ad.rotation.y = side === 1 ? Math.PI : 0;
      tower.add(ad);
      scene.add(tower);
      for (let flowerIndex = 0; flowerIndex < 3; flowerIndex++) {
        plantFlower(tower.position.x + Math.cos(angle) * (flowerIndex - 1) * 35, tower.position.z + Math.sin(angle) * (flowerIndex - 1) * 35, .9, i + flowerIndex);
      }
    }
    [...flowerInstances, stemInstances, heartInstances, ...windowInstances].forEach(mesh => {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    });

    function addFlowerIsland(x, z) {
      const island = new THREE.Mesh(new THREE.CylinderGeometry(68, 74, 3, 32), new THREE.MeshStandardMaterial({ color: 0x27483a, roughness: .94 }));
      island.position.set(x, 1, z);
      island.receiveShadow = true;
      scene.add(island);
      for (let i = 0; i < 34; i++) {
        const a = i * 2.399, r = 9 + (i % 5) * 9;
        plantFlower(x + Math.cos(a) * r, z + Math.sin(a) * r, .8 + (i % 4) * .1, i);
      }
    }
    addFlowerIsland(1200, 900);

    const streetLampPole = new THREE.MeshStandardMaterial({ color: 0x192331, metalness: .74, roughness: .34 });
    const streetLampColors = [
      new THREE.MeshStandardMaterial({ color: 0x72f4d8, emissive: 0x39e9ce, emissiveIntensity: 2.2 }),
      new THREE.MeshStandardMaterial({ color: 0xff81c7, emissive: 0xf64da8, emissiveIntensity: 2 }),
      new THREE.MeshStandardMaterial({ color: 0xffd77e, emissive: 0xffbd4e, emissiveIntensity: 1.8 })
    ];
    for (let i = 0; i < route.length * 3; i++) {
      const t = i / 3, p = routePoint(t), before = routePoint(t - .01), after = routePoint(t + .01);
      const angle = Math.atan2(after.y - before.y, after.x - before.x);
      const side = i % 2 ? 1 : -1;
      const group = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 33, 6), streetLampPole);
      pole.position.y = 16.5;
      group.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(15, 1.1, 1.1), streetLampPole);
      arm.position.set(-side * 6, 32, 0);
      group.add(arm);
      const lampColor = (Math.floor(i / 3) % streetLampColors.length);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(3.5, 8, 6), streetLampColors[lampColor]);
      bulb.position.set(-side * 12, 30, 0);
      group.add(bulb);
      group.position.set(p.x - Math.sin(angle) * 164 * side, 0, p.y + Math.cos(angle) * 164 * side);
      group.rotation.y = -angle;
      scene.add(group);
      if (i % 3 === 0) {
        const lampLight = new THREE.PointLight([0x72f4d8, 0xff81c7, 0xffd77e][lampColor], 28, 145, 2);
        lampLight.position.set(group.position.x - Math.sin(angle) * side * 12, 27, group.position.z + Math.cos(angle) * side * 12);
        scene.add(lampLight);
      }
    }

    const garage = new THREE.Group();
    const archMat = new THREE.MeshStandardMaterial({ color: 0x6ff5db, emissive: 0x2cccb7, emissiveIntensity: 1.6, metalness: .2, roughness: .3 });
    const archLeft = new THREE.Mesh(new THREE.BoxGeometry(4, 36, 5), archMat);
    archLeft.position.set(0, 18, -155); garage.add(archLeft);
    const archRight = archLeft.clone(); archRight.position.z = 155; garage.add(archRight);
    const archTop = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 310), archMat);
    archTop.position.set(0, 37, 0); garage.add(archTop);
    const garageAhead = routePoint(.01);
    const garageAngle = Math.atan2(garageAhead.y - route[0].y, garageAhead.x - route[0].x);
    garage.position.set(route[0].x - Math.cos(garageAngle) * 145, 0, route[0].y - Math.sin(garageAngle) * 145);
    scene.add(garage);

    const tireMaterial = new THREE.MeshStandardMaterial({ color: 0x11151b, roughness: .88 });
    const glassMaterial = new THREE.MeshPhysicalMaterial({ color: 0x243b52, metalness: .36, roughness: .12, clearcoat: 1, clearcoatRoughness: .08 });
    const blackMaterial = new THREE.MeshStandardMaterial({ color: 0x111923, metalness: .42, roughness: .36 });
    const makeBadge = (name, model) => {
      const badge = document.createElement("canvas");
      badge.width = 256; badge.height = 96;
      const bctx = badge.getContext("2d");
      bctx.fillStyle = "#132431";
      bctx.fillRect(0, 0, badge.width, badge.height);
      bctx.fillStyle = "#f4fbff";
      bctx.font = "800 40px sans-serif";
      bctx.textAlign = "center"; bctx.textBaseline = "middle";
      bctx.fillText(name, 128, 34);
      bctx.fillStyle = "#6cf4db";
      bctx.font = "600 21px sans-serif";
      bctx.fillText(model, 128, 70);
      const texture = new THREE.CanvasTexture(badge);
      texture.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    };

    function createCar(name, model, color, police = false, playerEffects = false) {
      const group = new THREE.Group();
      const paint = new THREE.MeshPhysicalMaterial({
        color,
        emissive: color,
        emissiveIntensity: .025,
        roughness: .28,
        metalness: .18,
        clearcoat: .8,
        clearcoatRoughness: .16
      });
      const rally = model.includes("Rally");
      const sedan = model.includes("RS") || police;
      const bodyLength = rally ? 27 : sedan ? 34 : 31;
      const bodyWidth = rally ? 15.5 : 14;
      const bodyStations = [
        [bodyLength * .5, .45, 2.45, 4.8],
        [bodyLength * .43, .76, 2, 5.75],
        [bodyLength * .26, .98, 2, 6.55],
        [-bodyLength * .22, .96, 2, 6.5],
        [-bodyLength * .42, .76, 2, 5.85],
        [-bodyLength * .5, .46, 2.4, 4.75]
      ];
      const bodyProfile = [
        [-.76, 0], [.76, 0], [1, .2], [1, .78],
        [.76, 1], [-.76, 1], [-1, .78], [-1, .2]
      ];
      const bodyVertices = [], bodyIndices = [];
      bodyStations.forEach(([x, halfWidth, bottom, top]) => {
        bodyProfile.forEach(([zScale, heightRatio]) => {
          bodyVertices.push(x, bottom + (top - bottom) * heightRatio, zScale * halfWidth * bodyWidth * .5);
        });
      });
      const ringSize = bodyProfile.length;
      for (let station = 0; station < bodyStations.length - 1; station++) {
        for (let vertex = 0; vertex < ringSize; vertex++) {
          const a = station * ringSize + vertex;
          const b = station * ringSize + (vertex + 1) % ringSize;
          const c = (station + 1) * ringSize + vertex;
          const d = (station + 1) * ringSize + (vertex + 1) % ringSize;
          bodyIndices.push(a, b, c, b, d, c);
        }
      }
      for (const station of [0, bodyStations.length - 1]) {
        const [x, , bottom, top] = bodyStations[station];
        const center = bodyVertices.length / 3;
        bodyVertices.push(x, (bottom + top) * .5, 0);
        for (let vertex = 0; vertex < ringSize; vertex++) {
          bodyIndices.push(center, station * ringSize + vertex, station * ringSize + (vertex + 1) % ringSize);
        }
      }
      const bodyGeometry = new THREE.BufferGeometry();
      bodyGeometry.setAttribute("position", new THREE.Float32BufferAttribute(bodyVertices, 3));
      bodyGeometry.setIndex(bodyIndices);
      bodyGeometry.computeVertexNormals();
      const chassis = new THREE.Group();
      group.add(chassis);
      const body = new THREE.Mesh(bodyGeometry, paint);
      body.material.side = THREE.DoubleSide;
      body.castShadow = true;
      chassis.add(body);
      const cabinLength = sedan ? 15 : rally ? 11 : 13;
      const cabinHeight = rally ? 5.4 : 4.9;
      const cabinProfile = new THREE.Shape();
      cabinProfile.moveTo(-cabinLength / 2, 0);
      cabinProfile.quadraticCurveTo(-cabinLength * .28, -.15, cabinLength * .4, 0);
      cabinProfile.quadraticCurveTo(cabinLength * .47, .12, cabinLength * .32, cabinHeight * .74);
      cabinProfile.quadraticCurveTo(cabinLength * .27, cabinHeight, 0, cabinHeight);
      cabinProfile.quadraticCurveTo(-cabinLength * .3, cabinHeight * .99, -cabinLength * .42, cabinHeight * .57);
      cabinProfile.quadraticCurveTo(-cabinLength * .5, cabinHeight * .12, -cabinLength / 2, 0);
      cabinProfile.closePath();
      const cabinWidth = bodyWidth - 4.2;
      const cabinGeometry = new THREE.ExtrudeGeometry(cabinProfile, { depth: cabinWidth, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .28, bevelThickness: .18, curveSegments: 8 });
      cabinGeometry.translate(0, 0, -cabinWidth / 2);
      const cabin = new THREE.Mesh(cabinGeometry, glassMaterial);
      cabin.position.set(-1.7, 6, 0); cabin.castShadow = true; chassis.add(cabin);
      const roof = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), paint);
      roof.scale.set((sedan ? 5.1 : 4.3), .42, (bodyWidth - 5.8) * .5);
      roof.position.set(-1.8, 6 + cabinHeight - .08, 0); roof.castShadow = true; chassis.add(roof);
      const pillarMaterial = new THREE.MeshStandardMaterial({ color: 0x18202b, metalness: .48, roughness: .3 });
      for (const side of [-1, 1]) {
        const z = side * (bodyWidth - 3.7) * .5;
        for (const [x, height, lean] of [
          [-1.7 - cabinLength * .4, cabinHeight * .58, -.12],
          [-1.7 - cabinLength * .12, cabinHeight * .96, -.035],
          [-1.7 + cabinLength * .27, cabinHeight * .76, .12]
        ]) {
          const pillar = new THREE.Mesh(new THREE.BoxGeometry(.42, height, .38), pillarMaterial);
          pillar.position.set(x, 6 + height * .48, z);
          pillar.rotation.z = lean;
          chassis.add(pillar);
        }
        const beltline = new THREE.Mesh(new THREE.BoxGeometry(cabinLength * .88, .3, .32), blackMaterial);
        beltline.position.set(-1.7, 6.25, side * (bodyWidth - 3.65) * .5);
        chassis.add(beltline);
      }
      if (rally) {
        const spoiler = new THREE.Mesh(new THREE.BoxGeometry(6.5, .65, bodyWidth + .8), blackMaterial);
        spoiler.position.set(-bodyLength * .46, 8.3, 0); chassis.add(spoiler);
      }
      const sideSkirt = new THREE.Mesh(new THREE.BoxGeometry(bodyLength * .56, .65, .6), blackMaterial);
      sideSkirt.position.set(-.3, 2.85, bodyWidth * .5); chassis.add(sideSkirt);
      for (const side of [-1, 1]) {
        const mirror = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), paint);
        mirror.scale.set(.9, .55, .7);
        mirror.position.set(bodyLength * .13, 7.15, side * (bodyWidth * .52));
        chassis.add(mirror);
        const mirrorStem = new THREE.Mesh(new THREE.CylinderGeometry(.13, .2, 1.1, 7), blackMaterial);
        mirrorStem.position.set(bodyLength * .13, 6.85, side * (bodyWidth * .48));
        mirrorStem.rotation.x = side * .45;
        chassis.add(mirrorStem);
      }

      const wheelRadius = rally ? 3 : 2.55;
      const wheelY = wheelRadius + .15;
      const wheelZ = bodyWidth * .5 - .45;
      const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 1.9, 20);
      const wheels = [], brakeLights = [];
      const wheelArchMaterial = new THREE.MeshStandardMaterial({ color: 0x202631, metalness: .26, roughness: .42 });
      for (const x of [-bodyLength * .31, bodyLength * .31]) {
        for (const z of [-wheelZ, wheelZ]) {
          const steeringPivot = new THREE.Group();
          steeringPivot.position.set(x, wheelY, z);
          group.add(steeringPivot);
          const wheelSpin = new THREE.Group();
          wheelSpin.rotation.order = "ZXY";
          steeringPivot.add(wheelSpin);
          const wheel = new THREE.Mesh(wheelGeo, tireMaterial);
          wheel.rotation.x = Math.PI / 2;
          wheel.castShadow = true;
          wheelSpin.add(wheel);
          const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelRadius * .56, wheelRadius * .56, 2, 14), new THREE.MeshStandardMaterial({ color: 0x9aabba, metalness: .82, roughness: .24 }));
          rim.rotation.x = Math.PI / 2;
          wheelSpin.add(rim);
          wheels.push({ steeringPivot, wheelSpin, front: x > 0, radius: wheelRadius });
          const arch = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius + .48, .34, 8, 24), wheelArchMaterial);
          arch.position.set(x, wheelY, Math.sign(z) * (bodyWidth * .5 + .05));
          group.add(arch);
        }
      }

      const headlightMat = new THREE.MeshStandardMaterial({ color: 0xeaffd3, emissive: 0xcbefff, emissiveIntensity: 1.7, roughness: .2 });
      const tailMat = new THREE.MeshStandardMaterial({ color: 0xff526d, emissive: 0xff1839, emissiveIntensity: 1.4, roughness: .26 });
      for (const side of [-1, 1]) {
        const head = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), headlightMat);
        head.scale.set(.55, .52, 1.45);
        head.position.set(bodyLength * .47, 5, side * bodyWidth * .31); chassis.add(head);
        const tail = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), tailMat);
        tail.scale.set(.48, .55, 1.35);
        tail.position.set(-bodyLength * .47, 4.7, side * bodyWidth * .31); chassis.add(tail);
        brakeLights.push(tail);
      }
      const exhaustFlames = [];
      let exhaustLight = null;
      if (playerEffects) {
        const flameMaterial = new THREE.MeshBasicMaterial({
          color: 0x8ffff0, transparent: true, opacity: .9, blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const flameGeometry = new THREE.ConeGeometry(1.25, 5.5, 8);
        for (const side of [-1, 1]) {
          const flame = new THREE.Mesh(flameGeometry, flameMaterial);
          flame.rotation.z = Math.PI / 2;
          flame.position.set(-bodyLength * .51, 4.1, side * 2.4);
          flame.visible = false;
          chassis.add(flame);
          exhaustFlames.push(flame);
        }
        exhaustLight = new THREE.PointLight(0x55f5dc, 0, 46, 2);
        exhaustLight.position.set(-bodyLength * .48, 4.5, 0);
        chassis.add(exhaustLight);
      }
      const grille = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), blackMaterial);
      grille.scale.set(.5, .82, 2.8);
      grille.position.set(bodyLength * .49, 3.8, 0); chassis.add(grille);
      const badge = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.8), makeBadge(name, model));
      badge.position.set(-bodyLength * .495, 4.05, 0); badge.rotation.y = -Math.PI / 2; chassis.add(badge);
      const decal = new THREE.Mesh(new THREE.BoxGeometry(.4, 1, 9), new THREE.MeshStandardMaterial({ color: 0xffd3ef, metalness: .2, roughness: .35 }));
      decal.position.set(-5, 4.8, bodyWidth * .5 + .1); chassis.add(decal);

      if (police) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 9), blackMaterial);
        bar.position.set(-2, 12.5, 0); chassis.add(bar);
        const red = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 3.7), new THREE.MeshBasicMaterial({ color: 0xff4068 }));
        red.position.set(-2, 13.4, -2.25); chassis.add(red);
        const blue = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 3.7), new THREE.MeshBasicMaterial({ color: 0x4d83ff }));
        blue.position.set(-2, 13.4, 2.25); chassis.add(blue);
      }
      group.userData = { name, model, police, wheels, chassis, brakeLights, exhaustFlames, exhaustLight, paint, baseY: .2 };
      return group;
    }

    const cameraModes = ["COCKPIT", "HOOD", "CHASE"];
    let cameraMode = 0;
    const cameraLookTarget = new THREE.Vector3();
    const desiredLookTarget = new THREE.Vector3();
    const cameraPositionTarget = new THREE.Vector3();
    const playerVehicle = createCar("NOVA", "Vesper GT", 0xf178bc, false, true);
    playerVehicle.visible = false;
    scene.add(playerVehicle);
    const smokeCapacity = 28;
    const smokeGeometry = new THREE.SphereGeometry(1, 8, 6);
    const smokeMaterial = new THREE.MeshStandardMaterial({
      color: 0xb9c7ce, transparent: true, opacity: .38, roughness: 1, depthWrite: false
    });
    const smokeMesh = new THREE.InstancedMesh(smokeGeometry, smokeMaterial, smokeCapacity);
    smokeMesh.frustumCulled = false;
    scene.add(smokeMesh);
    const hiddenInstanceMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < smokeCapacity; i++) smokeMesh.setMatrixAt(i, hiddenInstanceMatrix);
    smokeMesh.instanceMatrix.needsUpdate = true;
    const smokePool = Array.from({ length: smokeCapacity }, () => ({
      position: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, maxLife: 1, size: 1
    }));
    const skidCapacity = 64;
    const skidMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(4, .035, .8),
      new THREE.MeshBasicMaterial({ color: 0x171b20, transparent: true, opacity: .42, depthWrite: false }),
      skidCapacity
    );
    skidMesh.frustumCulled = false;
    scene.add(skidMesh);
    for (let i = 0; i < skidCapacity; i++) skidMesh.setMatrixAt(i, hiddenInstanceMatrix);
    skidMesh.instanceMatrix.needsUpdate = true;
    const skidPool = Array.from({ length: skidCapacity }, () => ({
      position: new THREE.Vector3(), angle: 0, life: 0, maxLife: 2.5
    }));
    const instancePosition = new THREE.Vector3();
    const instanceScale = new THREE.Vector3();
    const instanceRotation = new THREE.Quaternion();
    const instanceMatrix = new THREE.Matrix4();
    const upAxis = new THREE.Vector3(0, 1, 0);
    const smokeColor = new THREE.Color();
    let smokeCursor = 0, skidCursor = 0, smokeTimer = 0, skidTimer = 0;
    const cycleCamera = () => {
      cameraMode = (cameraMode + 1) % cameraModes.length;
      cockpit.visible = cameraMode !== 2;
      playerVehicle.visible = cameraMode === 2;
      return cameraModes[cameraMode];
    };
    const updateWheels = (vehicle, speed, steering, dt) => {
      vehicle.userData.wheels.forEach(wheel => {
        wheel.steeringPivot.rotation.y = wheel.front ? -steering * .48 : 0;
        const spin = speed * dt / wheel.radius;
        wheel.wheelSpin.rotation.z += spin;
      });
    };

    const trafficSpecs = [
      { name: "NOVA", model: "Vesper GT", color: 0x70d7cf, progress: .25 },
      { name: "ASTER", model: "Luma RS", color: 0xf1ad72, progress: 2.55 },
      { name: "SOLARA", model: "Pico Rally", color: 0x9e91ff, progress: 5.1 }
    ];
    const traffic = trafficSpecs.map(spec => {
      const vehicle = createCar(spec.name, spec.model, spec.color);
      scene.add(vehicle);
      return { vehicle, ...spec };
    });
    const policeCars = [];
    const pickupMeshes = [];
    let pickupSignature = "";
    let pickupGlow = [];

    function syncPickups(pickups) {
      const signature = pickups.map(p => `${p.type}:${p.x}:${p.y}`).join("|");
      if (signature === pickupSignature) return;
      pickupSignature = signature;
      pickupMeshes.forEach(mesh => scene.remove(mesh));
      pickupGlow.forEach(mesh => scene.remove(mesh));
      pickupMeshes.length = 0; pickupGlow.length = 0;
      pickups.forEach(pickup => {
        const group = new THREE.Group();
        const color = pickup.type === "core" ? 0xff79c5 : pickup.type === "boost" ? 0x72f4d8 : 0xb7a3ff;
        const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, roughness: .3, metalness: .16 });
        const petal = new THREE.Mesh(new THREE.IcosahedronGeometry(4.2, 1), material);
        group.add(petal);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(7, .8, 6, 18), material);
        ring.rotation.x = Math.PI / 2; group.add(ring);
        group.position.set(pickup.x, 11, pickup.y);
        group.userData = { pickup };
        scene.add(group);
        pickupMeshes.push(group);
      });
    }

    function addStreetFlowers() {
      for (let i = 0; i < route.length * 8; i++) {
        const t = i / 8;
        const p = routePoint(t), before = routePoint(t - .01), after = routePoint(t + .01);
        const a = Math.atan2(after.y - before.y, after.x - before.x);
        const side = i % 2 ? 1 : -1;
        const offset = 155 + (i % 3) * 19;
        plantFlower(p.x + Math.sin(a) * offset * side, p.y - Math.cos(a) * offset * side, .7 + (i % 4) * .08, i);
      }
    }
    addStreetFlowers();

    function updateDriftEffects(car, drift, elapsed, dt) {
      if (drift > .2 && Math.abs(car.speed) > 125) {
        smokeTimer -= dt;
        if (smokeTimer <= 0) {
          const side = smokeCursor % 2 ? 1 : -1;
          const smokeIndex = smokeCursor;
          const particle = smokePool[smokeIndex];
          smokeCursor = (smokeCursor + 1) % smokeCapacity;
          const forwardX = Math.cos(car.angle), forwardZ = Math.sin(car.angle);
          const sideX = -forwardZ, sideZ = forwardX;
          particle.position.set(
            car.x - forwardX * 12 + sideX * side * 8,
            3.1,
            car.y - forwardZ * 12 + sideZ * side * 8
          );
          particle.velocity.set(
            -forwardX * (7 + Math.abs(car.speed) * .045) + sideX * side * 3,
            5,
            -forwardZ * (7 + Math.abs(car.speed) * .045) + sideZ * side * 3
          );
          particle.life = particle.maxLife = .58 + (smokeCursor % 4) * .07;
          particle.size = 2.6 + (smokeCursor % 3) * .45;
          smokeColor.setRGB(.72, .76, .79);
          smokeMesh.setColorAt(smokeIndex, smokeColor);
          smokeMesh.instanceColor.needsUpdate = true;
          smokeTimer = .07;
        }
        skidTimer -= dt;
        if (skidTimer <= 0) {
          const forwardX = Math.cos(car.angle), forwardZ = Math.sin(car.angle);
          const sideX = -forwardZ, sideZ = forwardX;
          for (const side of [-1, 1]) {
            const mark = skidPool[skidCursor];
            skidCursor = (skidCursor + 1) % skidCapacity;
            mark.position.set(
              car.x - forwardX * 12 + sideX * side * 6,
              .12,
              car.y - forwardZ * 12 + sideZ * side * 6
            );
            mark.angle = car.angle;
            mark.life = mark.maxLife;
          }
          skidTimer = .095;
        }
      } else {
        smokeTimer = Math.min(smokeTimer, .035);
        skidTimer = Math.min(skidTimer, .045);
      }

      let smokeMatrixChanged = false;
      for (let i = 0; i < smokeCapacity; i++) {
        const particle = smokePool[i];
        if (particle.life <= 0) continue;
        particle.life = Math.max(0, particle.life - dt);
        particle.position.addScaledVector(particle.velocity, dt);
        particle.velocity.y += dt * 2.2;
        const fade = particle.life / particle.maxLife;
        const scale = particle.size * (1.05 - fade * .42);
        instancePosition.copy(particle.position);
        instanceScale.setScalar(scale * fade);
        instanceMatrix.compose(instancePosition, instanceRotation, instanceScale);
        smokeMesh.setMatrixAt(i, instanceMatrix);
        smokeMatrixChanged = true;
      }
      if (smokeMatrixChanged) smokeMesh.instanceMatrix.needsUpdate = true;

      let skidMatrixChanged = false;
      for (let i = 0; i < skidCapacity; i++) {
        const mark = skidPool[i];
        if (mark.life <= 0) continue;
        mark.life = Math.max(0, mark.life - dt);
        const fade = mark.life / mark.maxLife;
        instancePosition.copy(mark.position);
        instanceRotation.setFromAxisAngle(upAxis, -mark.angle);
        instanceScale.set(fade, fade ? 1 : 0, fade);
        instanceMatrix.compose(instancePosition, instanceRotation, instanceScale);
        skidMesh.setMatrixAt(i, instanceMatrix);
        skidMatrixChanged = true;
      }
      if (skidMatrixChanged) skidMesh.instanceMatrix.needsUpdate = true;
    }

    function updatePlayerEffects(state, elapsed) {
      const { car } = state;
      const dt = state.deltaTime;
      const speedRatio = Math.min(1, Math.abs(car.speed) / 400);
      const blend = 1 - Math.exp(-dt * 8);
      const acceleration = state.acceleration || 0;
      const chassis = playerVehicle.userData.chassis;
      const targetPitch = THREE.MathUtils.clamp(acceleration * .000085, -.035, .035);
      const targetRoll = -car.steering * speedRatio * .045;
      const suspension = .18 + Math.sin(elapsed * (7 + speedRatio * 6)) * speedRatio * .16;
      chassis.rotation.z += (targetPitch - chassis.rotation.z) * blend;
      chassis.rotation.x += (targetRoll - chassis.rotation.x) * blend;
      chassis.position.y += (suspension - chassis.position.y) * blend;

      const braking = state.braking || acceleration < -35;
      const brakeIntensity = 1.4 + (braking ? 3.6 : Math.min(1, Math.max(0, -acceleration / 220)) * 1.8);
      playerVehicle.userData.brakeLights.forEach(light => {
        light.material.emissiveIntensity = brakeIntensity;
      });

      const boost = car.boostTime > 0 ? Math.min(1, car.boostTime / .35) : 0;
      const flameFlicker = .78 + .22 * Math.sin(elapsed * 53);
      playerVehicle.userData.exhaustFlames.forEach((flame, index) => {
        flame.visible = boost > .02;
        if (flame.visible) {
          const length = (.42 + boost * .82) * flameFlicker;
          flame.scale.set(.55 * length, length, .55 * length);
          flame.position.y = 4.1 + Math.sin(elapsed * 31 + index) * .22;
        }
      });
      if (playerVehicle.userData.exhaustLight) {
        playerVehicle.userData.exhaustLight.intensity = boost * 22 * flameFlicker;
      }
      updateDriftEffects(car, state.drift || 0, elapsed, dt);
    }

    function routePoint(t) {
      const i = ((Math.floor(t) % route.length) + route.length) % route.length;
      const p = t - Math.floor(t);
      const a = route[(i - 1 + route.length) % route.length], b = route[i];
      const c = route[(i + 1) % route.length], d = route[(i + 2) % route.length];
      const p2 = p * p, p3 = p2 * p;
      return {
        x: .5 * ((2 * b.x) + (-a.x + c.x) * p + (2*a.x - 5*b.x + 4*c.x - d.x) * p2 + (-a.x + 3*b.x - 3*c.x + d.x) * p3),
        y: .5 * ((2 * b.y) + (-a.y + c.y) * p + (2*a.y - 5*b.y + 4*c.y - d.y) * p2 + (-a.y + 3*b.y - 3*c.y + d.y) * p3)
      };
    }

    function render(state) {
      const width = canvas.clientWidth, height = canvas.clientHeight;
      if (!width || !height) return;
      if (canvas.width !== Math.round(width * renderer.getPixelRatio()) || canvas.height !== Math.round(height * renderer.getPixelRatio())) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      const { car, cops, pickups, elapsed } = state;
      temporalUniforms.uTime.value = elapsed;
      temporalUniforms.uMotion.value = Math.min(1, Math.abs(car.speed) / 400);
      temporalUniforms.uBoost.value = car.boostTime > 0 ? 1 : 0;
      temporalUniforms.uHeat.value = Math.min(1, cops.length / 3);
      const motion = Math.min(1, Math.abs(car.speed) / 400);
      const boost = car.boostTime > 0 ? 1 : 0;
      const overlayHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * temporalOverlayDistance;
      const overlayWidth = overlayHeight * camera.aspect;
      temporalOverlay.scale.set(overlayWidth, overlayHeight, 1);
      speedLines.scale.set(overlayWidth, overlayHeight, 1);
      speedLines.material.opacity = Math.min(.72, Math.max(0, (motion - .34) * .8 + boost * .48));
      for (let i = 0; i < speedLineCount; i++) {
        const angle = i * 2.399 + .4;
        const phase = (elapsed * (1.6 + motion * 2.4) + i * .173) % 1;
        const radius = .32 + phase * .16;
        const length = (.02 + phase * .055) * speedLines.material.opacity;
        const offset = i * 6;
        speedLinePositions[offset] = Math.cos(angle) * radius;
        speedLinePositions[offset + 1] = Math.sin(angle) * radius;
        speedLinePositions[offset + 2] = 0;
        speedLinePositions[offset + 3] = Math.cos(angle) * (radius + length);
        speedLinePositions[offset + 4] = Math.sin(angle) * (radius + length);
        speedLinePositions[offset + 5] = 0;
      }
      speedLineGeometry.attributes.position.needsUpdate = true;
      speedLineGeometry.setDrawRange(0, speedLineCount * 2);
      const dx = Math.cos(car.angle), dz = Math.sin(car.angle);
      const cameraBlend = 1 - Math.exp(-Math.max(state.deltaTime, .001) * 5.5);
      if (cameraMode === 0) {
        cameraPositionTarget.set(car.x - dx * 3, 8.5, car.y - dz * 3);
        desiredLookTarget.set(car.x + dx * 70, .5, car.y + dz * 70);
      } else if (cameraMode === 1) {
        cameraPositionTarget.set(car.x + dx * 8, 6, car.y + dz * 8);
        desiredLookTarget.set(car.x + dx * 125, 1, car.y + dz * 125);
      } else {
        cameraPositionTarget.set(car.x - dx * 86, 29, car.y - dz * 86);
        desiredLookTarget.set(car.x + dx * 38, 5, car.y + dz * 38);
      }
      camera.position.lerp(cameraPositionTarget, cameraBlend);
      cameraLookTarget.lerp(desiredLookTarget, cameraBlend);
      const targetFov = 67 + motion * 2.5 + boost * 8;
      camera.fov += (targetFov - camera.fov) * cameraBlend;
      camera.updateProjectionMatrix();
      const shake = (cameraMode === 2 ? motion * .28 : .06) + boost * .22;
      camera.position.x += Math.sin(elapsed * 31) * shake;
      camera.position.y += Math.sin(elapsed * 43) * shake * .45;
      camera.lookAt(cameraLookTarget);
      camera.updateMatrixWorld();

      playerVehicle.position.set(car.x, .2, car.y);
      playerVehicle.rotation.y = -car.angle;
      updateWheels(playerVehicle, car.speed, car.steering, state.deltaTime);
      updatePlayerEffects(state, elapsed);

      traffic.forEach(item => {
        const t = item.progress + elapsed * .018;
        const point = routePoint(t), next = routePoint(t + .008);
        item.vehicle.position.set(point.x, .2, point.y);
        item.vehicle.rotation.y = -Math.atan2(next.y - point.y, next.x - point.x);
        updateWheels(item.vehicle, 105, 0, state.deltaTime);
      });
      while (policeCars.length < cops.length) {
        const group = createCar("VANTA", "Interceptor S", 0xf1f0eb, true);
        scene.add(group); policeCars.push(group);
      }
      while (policeCars.length > cops.length) scene.remove(policeCars.pop());
      cops.forEach((cop, i) => {
        const group = policeCars[i];
        group.position.set(cop.x, .22, cop.y);
        group.rotation.y = -cop.angle;
        updateWheels(group, cop.speed, 0, state.deltaTime);
        group.visible = cop.stunned <= 0 || Math.floor(elapsed * 12) % 2 === 0;
      });
      syncPickups(pickups);
      pickupMeshes.forEach(mesh => {
        const { pickup } = mesh.userData;
        mesh.visible = !pickup.got;
        mesh.rotation.y += .02;
        mesh.position.y = 12 + Math.sin(elapsed * 3 + pickup.x) * 2;
      });
      renderer.render(scene, camera);
    }

    return { render, cycleCamera, cameraModes };
  }

  window.PetalRun3D = { create };
})();
