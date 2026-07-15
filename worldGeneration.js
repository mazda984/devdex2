import * as THREE from "three";

// Simple seeded random number generator
class MathRandom {
  constructor(seed) {
    this.seed = seed;
  }
  
  random() {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }
}

export function createBarriers(scene) {
  // Use a deterministic random number generator based on a fixed seed
  const barrierSeed = 12345; // Fixed seed for deterministic generation
  let rng = new MathRandom(barrierSeed);
  
  // Wall material
  const wallMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x888888,
    roughness: 0.7,
    metalness: 0.2
  });
  
  // Create some random barriers
  for (let i = 0; i < 25; i++) {  
    const width = 1 + rng.random() * 3;
    const height = 1 + rng.random() * 3;
    const depth = 1 + rng.random() * 3;
    
    const wallGeometry = new THREE.BoxGeometry(width, height, depth);
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    
    // Random position, but not too close to center
    const angle = rng.random() * Math.PI * 2;
    const distance = 10 + rng.random() * 40;  
    wall.position.x = Math.cos(angle) * distance;
    wall.position.z = Math.sin(angle) * distance;
    wall.position.y = height / 2;
    
    wall.castShadow = true;
    wall.receiveShadow = true;
    wall.userData.isBarrier = true;
    
    scene.add(wall);
  }
  
  // Add decorative pillars throughout the scene
  const pillarCount = 15;
  for (let i = 0; i < pillarCount; i++) {
    const angle = rng.random() * Math.PI * 2;
    const distance = 10 + rng.random() * 40;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    
    // Create a tall, thin pillar with much more height variation
    const pillarHeight = 2 + rng.random() * 15; 
    const pillarWidth = 0.8 + rng.random() * 0.6;
    const pillarGeo = new THREE.BoxGeometry(pillarWidth, pillarHeight, pillarWidth);
    
    // Use a slightly different material for pillars
    const pillarMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xaaaaaa,
      roughness: 0.6,
      metalness: 0.3
    });
    
    const pillar = new THREE.Mesh(pillarGeo, pillarMaterial);
    pillar.position.set(x, pillarHeight/2, z);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    pillar.userData.isBarrier = true;
    
    // Add a decorative cap to the pillar
    const capSize = pillarWidth * 1.5;
    const capHeight = 0.5;
    const capGeo = new THREE.BoxGeometry(capSize, capHeight, capSize);
    const cap = new THREE.Mesh(capGeo, wallMaterial);
    cap.position.y = pillarHeight/2 + capHeight/2;
    pillar.add(cap);
    
    scene.add(pillar);
  }
}

export function createTrees(scene) {
  // Use a deterministic random number generator for consistent tree placement
  const treeSeed = 54321; // Different seed than barriers
  let rng = new MathRandom(treeSeed);
  
  // Tree trunk materials (varying browns)
  const trunkMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: 0x6B4423, roughness: 0.9, metalness: 0.1 }),
    new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.8, metalness: 0.1 })
  ];
  
  // Tree leaves materials (varying greens)
  const leavesMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x2E8B57, roughness: 0.8, metalness: 0.0 }),
    new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8, metalness: 0.0 }),
    new THREE.MeshStandardMaterial({ color: 0x006400, roughness: 0.7, metalness: 0.0 })
  ];
  
  // Create different types of trees
  for (let i = 0; i < 30; i++) {  
    // Select random materials
    const trunkMaterial = trunkMaterials[Math.floor(rng.random() * trunkMaterials.length)];
    const leavesMaterial = leavesMaterials[Math.floor(rng.random() * leavesMaterials.length)];
    
    // Create tree group
    const tree = new THREE.Group();
    
    // Create tree trunk
    const trunkHeight = 5 + rng.random() * 7;
    const trunkRadius = 0.3 + rng.random() * 0.3;
    const trunkGeometry = new THREE.CylinderGeometry(trunkRadius * 0.8, trunkRadius * 1.2, trunkHeight, 8);
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);
    
    // Determine tree type (pine or broad-leaf)
    const isPine = rng.random() > 0.5;
    
    if (isPine) {
      // Pine tree (multiple cones stacked)
      const layers = 2 + Math.floor(rng.random() * 3);
      const baseRadius = trunkRadius * 6;
      const layerHeight = trunkHeight * 0.4;
      
      for (let j = 0; j < layers; j++) {
        const layerRadius = baseRadius * (1 - j * 0.2);
        const coneGeometry = new THREE.ConeGeometry(layerRadius, layerHeight, 8);
        const cone = new THREE.Mesh(coneGeometry, leavesMaterial);
        cone.position.y = trunkHeight * 0.5 + j * (layerHeight * 0.6);
        cone.castShadow = true;
        cone.receiveShadow = true;
        tree.add(cone);
      }
    } else {
      // Broad-leaf tree (ellipsoidQuestion of and also a sphere
      const leafShape = rng.random() > 0.5 ? 'ellipsoid' : 'sphere';
      const leavesRadius = trunkRadius * (4 + rng.random() * 2);
      
      if (leafShape === 'ellipsoid') {
        // Create ellipsoid using scaled sphere
        const leavesGeometry = new THREE.SphereGeometry(leavesRadius, 8, 8);
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = trunkHeight * 0.7;
        leaves.scale.set(1, 1.2 + rng.random() * 0.5, 1);
        leaves.castShadow = true;
        leaves.receiveShadow = true;
        tree.add(leaves);
      } else {
        // Create multiple spheres for a more natural canopy
        const sphereCount = 2 + Math.floor(rng.random() * 3);
        for (let j = 0; j < sphereCount; j++) {
          const sphereSize = leavesRadius * (0.7 + rng.random() * 0.5);
          const leavesGeometry = new THREE.SphereGeometry(sphereSize, 8, 8);
          const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
          leaves.position.y = trunkHeight * 0.7;
          leaves.position.x = (rng.random() - 0.5) * trunkRadius * 2;
          leaves.position.z = (rng.random() - 0.5) * trunkRadius * 2;
          leaves.castShadow = true;
          leaves.receiveShadow = true;
          tree.add(leaves);
        }
      }
    }
    
    // Random position, avoiding center area and existing barriers
    const angle = rng.random() * Math.PI * 2;
    const distance = 15 + rng.random() * 40;  
    tree.position.x = Math.cos(angle) * distance;
    tree.position.z = Math.sin(angle) * distance;
    
    // Add some random rotation and scale variation
    tree.rotation.y = rng.random() * Math.PI * 2;
    const treeScale = 0.8 + rng.random() * 0.5;
    tree.scale.set(treeScale, treeScale, treeScale);
    
    // Add custom property for collision detection - move barrier detection to the whole tree instead
    tree.userData.isTree = true;
    tree.userData.isBarrier = true;
    
    scene.add(tree);
  }
}

export function createClouds(scene) {
  const cloudSeed = 67890; // Different seed for clouds
  let rng = new MathRandom(cloudSeed);
  
  const cloudMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff, // Pure white
    opacity: 0.95, // Slightly increased opacity
    transparent: true,
    roughness: 0.9, // Increased roughness to make it less shiny
    metalness: 0.0,
    emissive: 0xcccccc, // Add slight emissive color to make it brighter
    emissiveIntensity: 0.2 // Subtle emission to enhance whiteness
  });
  
  for (let i = 0; i < 20; i++) {
    const cloudGroup = new THREE.Group();
    
    // Create cloud with multiple spheres
    const puffCount = 3 + Math.floor(rng.random() * 5);
    for (let j = 0; j < puffCount; j++) {
      const puffSize = 2 + rng.random() * 3;
      const puffGeometry = new THREE.SphereGeometry(puffSize, 7, 7);
      const puff = new THREE.Mesh(puffGeometry, cloudMaterial);
      
      puff.position.x = (rng.random() - 0.5) * 5;
      puff.position.y = (rng.random() - 0.5) * 2;
      puff.position.z = (rng.random() - 0.5) * 5;
      
      cloudGroup.add(puff);
    }
    
    // Position the cloud
    const angle = rng.random() * Math.PI * 2;
    const distance = 20 + rng.random() * 60;
    cloudGroup.position.x = Math.cos(angle) * distance;
    cloudGroup.position.z = Math.sin(angle) * distance;
    cloudGroup.position.y = 20 + rng.random() * 15;
    
    // Random rotation
    cloudGroup.rotation.y = rng.random() * Math.PI * 2;
    
    // Add to scene
    scene.add(cloudGroup);
  }
}

export function generateCollectiblePositions(count) {
    const positions = {};
    const rng = new MathRandom(999); // Use a fixed seed for consistency

    for (let i = 0; i < count; i++) {
        const id = `collectible_${i}`;
        const angle = rng.random() * Math.PI * 2;
        const distance = 10 + rng.random() * 40;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        // Place them at a reachable height
        const y = 1 + rng.random() * 3;
        
        positions[id] = { x, y, z };
    }
    return positions;
}

export function createCollectibleMesh() {
    const geometry = new THREE.OctahedronGeometry(0.3, 0);
    const material = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffaa00,
        emissiveIntensity: 0.5,
        roughness: 0.2,
        metalness: 0.8,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.userData.isCollectible = true;
    return mesh;
}

function createStudioWorld(scene) {
    // A simple world for the studio demo.
    const boxGeometry = new THREE.BoxGeometry(5, 5, 5);
    const boxMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    box.position.set(0, 2.5, -10);
    box.castShadow = true;
    box.receiveShadow = true;
    box.userData.isBarrier = true;
    scene.add(box);

    const sphereGeometry = new THREE.SphereGeometry(3, 32, 16);
    const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00, roughness: 0.1, metalness: 0.5 });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(-10, 3, 0);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    sphere.userData.isBarrier = true;
    scene.add(sphere);

    const cylinderGeometry = new THREE.CylinderGeometry(2, 2, 8, 32);
    const cylinderMaterial = new THREE.MeshStandardMaterial({ color: 0xff00ff });
    const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
    cylinder.position.set(10, 4, 0);
    cylinder.castShadow = true;
    cylinder.receiveShadow = true;
    cylinder.userData.isBarrier = true;
    scene.add(cylinder);
}

export function createWorldForExperience(experienceId, scene) {
    if (experienceId === 'main-world') {
        createBarriers(scene);
        createTrees(scene);
        createClouds(scene);
    } else if (experienceId === 'studio-demo') {
        createStudioWorld(scene);
    } else if (experienceId === 'parkour') {
        // New parkour course generation
        const startX = -10;
        const startY = 1;
        const startZ = 0;

        const platformMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 });
        const checkpointMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.5, emissive: 0x114411, emissiveIntensity: 0.4 });

        const platformCount = 18;
        for (let i = 0; i < platformCount; i++) {
            const w = 1 + (i % 3) * 0.5;
            const d = 1 + ((i + 1) % 2) * 0.5;
            const h = startY + Math.floor(i / 3) * 1.2 + (i % 2 ? 0.5 : 0);
            const x = startX + i * 3 + (Math.sin(i * 0.7) * 1.2);
            const z = startZ + (i % 4 === 0 ? 2.5 : (i % 4 === 2 ? -2.5 : 0));

            const geo = new THREE.BoxGeometry(w, 0.4, d);
            const mesh = new THREE.Mesh(geo, platformMat);
            mesh.position.set(x, h, z);
            mesh.userData.isParkourPlatform = true;
            mesh.userData.isBarrier = true;
            scene.add(mesh);

            // occasional small pillar to hop onto
            if (i % 5 === 2) {
                const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.6), platformMat);
                pillar.position.set(x + 1.4, h + 0.6, z);
                pillar.userData.isParkourPlatform = true;
                pillar.userData.isBarrier = true;
                scene.add(pillar);
            }

            // Add a checkpoint every 6 platforms
            if ((i + 1) % 6 === 0) {
                const cp = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 12), checkpointMat);
                cp.position.set(x + 1.5, h + 0.3, z);
                cp.rotation.x = Math.PI / 2;
                cp.userData.isCheckpoint = true;
                scene.add(cp);
            }
        }

        // Finish area (a small platform plus a flag)
        const finish = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 4), new THREE.MeshStandardMaterial({ color: 0x3b82f6 }));
        finish.position.set(startX + platformCount * 3 + 3, startY + Math.floor(platformCount / 3) * 1.2, startZ);
        finish.userData.isParkourFinish = true;
        scene.add(finish);

        // Add some simple surrounding elements to make it readable
        createClouds(scene);
    } else {
        // Default world if ID is unknown
        createBarriers(scene);
        createTrees(scene);
        createClouds(scene);
    }
}