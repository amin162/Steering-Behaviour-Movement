import * as THREE from 'three';
import * as dat from 'dat.gui';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { normalize, randFloat, randFloatSpread } from 'three/src/math/MathUtils';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
    75, 
    window.innerWidth / window.innerHeight, 
    0.1, 1000
    );
const renderer = new THREE.WebGLRenderer();
const controls = new OrbitControls( camera, renderer.domElement );
scene.background = new THREE.Color(0x333333);
renderer.shadowMap.enabled = true;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Camera position
camera.position.set(0, 100, 250);
camera.lookAt(new THREE.Vector3(0, 0, 0));

//Declare dat.gui
const gui = new dat.GUI({ width: 300, height: 400 });

// Setting ground
const groundGeometry = new THREE.BoxGeometry(300, 0.5, 300);
const groundMaterial = new THREE.MeshStandardMaterial({color:0xffffff, side: THREE.DoubleSide});
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
groundMesh.position.y = -5;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

// Initialize Light
const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.y = 3;
light.position.z = 2;
light.castShadow = true;
scene.add(light);

//Setting controller value
let  controller = {
    plane: {
        width : groundGeometry.parameters.width,
        depth : groundGeometry.parameters.depth
    }
};

//Boid Class
class Boid {
    constructor(positionX, positionZ) {
        this.position = new THREE.Vector3(
            randFloat(-positionX/2, positionX/2),
            0,
            randFloat(-positionZ/2, positionZ/2)
        );
        this.velocity = new THREE.Vector3(
            randFloat(-1, 1),
            0,
            randFloat(-1, 1)
        );
        this.velocity.normalize();
        this.velocity.multiplyScalar(randFloat(2, 4));
        this.acceleration = new THREE.Vector3();
        this.maxSpeed = 20;
        this.minSpeed = 0;
        this.maxForce = 0.5;
        this.minForce = 0;

        this.coneGeometry = new THREE.ConeGeometry(2, 7, 8);
        this.coneMaterial = new THREE.MeshStandardMaterial(
            {color: "Black", 
             side: THREE.DoubleSide, 
             transparent: true}
        );
        this.coneMesh = new THREE.Mesh(this.coneGeometry, this.coneMaterial);
        
    }

    boundary(width, depth) {
        if (this.position.x > width) {
            this.position.x = -width;
        } else if (this.position.x < -width) {
            this.position.x = width;
        } else if (this.position.z > depth) {
            this.position.z = -depth;
        } else if (this.position.z < -depth) {
            this.position.z = depth;
        }
    }   

    update(){
        this.updateAngle();
        this.updatePosition();
    }

    updatePosition() {
        this.position.add(this.velocity);
        this.velocity.add(this.acceleration);
        this.velocity.normalize();
        this.velocity.clampLength(this.minSpeed, this.maxSpeed);
        this.acceleration.multiplyScalar(0);
    }

    updateAngle() {
        const rotationAngleX = Math.atan2
        (
            this.velocity.y, 
            Math.sqrt(this.velocity.x * this.velocity.x + 
                      this.velocity.z * this.velocity.z)
        );
        const rotationAngleZ = Math.atan2(
            this.velocity.x, 
            this.velocity.z);
        this.coneMesh.rotation.z = rotationAngleZ + Math.PI;
        this.coneMesh.rotation.x = rotationAngleX - Math.PI/2;
        this.coneMesh.position.copy(this.position);
    }
    
    display() {
        this.coneMesh.position.copy(this.position);
        scene.add(this.coneMesh);
    }
    
    applyForce(force){
        this.acceleration.add(force);
    }

    seek(target) {
        const desired = new THREE.Vector3().subVectors(target, this.position);
        desired.normalize();
        desired.multiplyScalar(this.maxSpeed);
        const steer = new THREE.Vector3().subVectors(desired,this.velocity);
        steer.clampLength(this.maxForce,this.maxForce);
        this.applyForce(steer);
    }

    eat(list) {
        let record = Infinity;
        let closest = -1;
        for(let i = 0; i < list.length; i++){
            let distance = this.position.distanceTo(list[i].position)
            if(distance < record){
                record = distance;
                closest = i;
            }
        }
        // Apply seeking behavior only once, after finding the closest target
        if (closest !== -1) {
            this.seek(list[closest].position);
        }

        if(record < 3) {
            list[closest].removeFood();
            list.splice(closest, 1);
        }
    }
}

class Particle {
    constructor(positionX, positionZ, color) {
     this.position = new THREE.Vector3(
            randFloat(-positionX/2, positionX/2),
            0,
            randFloat(-positionZ/2, positionZ/2)
     );

     this.particleGeometry = new THREE.SphereGeometry(1, 32, 32);
     this.particleMaterial = new THREE.MeshStandardMaterial(
        {color: color, 
         side: THREE.DoubleSide,
         transparent: true});
         
    this.particleMesh = new THREE.Mesh(
        this.particleGeometry, 
        this.particleMaterial
      );
    }

    boundary(width, depth) {
        if (this.position.x > width) {
            this.position.x = -width;
        } else if (this.position.x < -width) {
            this.position.x = width;
        } else if (this.position.z > depth) {
            this.position.z = -depth;
        } else if (this.position.z < -depth) {
            this.position.z = depth;
        }
    }  

    display() {
        this.particleMesh.position.copy(this.position);
        scene.add(this.particleMesh);
    }

    removeFood() {
        scene.remove(this.particleMesh);
    }
}

//Setting ground value
gui.add(controller.plane,"width", 50, 300).name("Width").onChange(generatePlane);
gui.add(controller.plane,"depth", 50, 300).name("Depth").onChange(generatePlane);

function generatePlane() {
    groundMesh.geometry.dispose();
    groundMesh.geometry = new THREE.BoxGeometry(
        controller.plane.width,
        0.5,
        controller.plane.depth
    );
}

//Initialize food
let foods = [];
for(let i = 0; i < 20; i++) {
    let food = new Particle(groundGeometry.parameters.width,
                            groundGeometry.parameters.depth, "Green");
    foods.push(food);
    // console.log(foods)
}

//Initialize food
let poisons = [];
for(let i = 0; i < 20; i++) {
    let poison = new Particle(groundGeometry.parameters.width,
                              groundGeometry.parameters.depth, "Red");
    poisons.push(poison);
    // console.log(foods)
}

// Initialize boid
let  boids = [];
for (let i = 0; i < 1; i++) {
    let boid = new Boid(groundGeometry.parameters.width,
                        groundGeometry.parameters.depth);
    boids.push(boid);
}



// Render loop
function animate() {
    requestAnimationFrame(animate);

    // Update boids
    for (let boid of boids) {
        boid.display();
        boid.update();
        boid.eat(foods);
        // boid.eat(poisons);
        boid.boundary(controller.plane.width/2,
                      controller.plane.depth/2);
    }
    
    //Initialized foods
    for(let food of foods){
        food.display();
        food.boundary(controller.plane.width/2,
                      controller.plane.depth/2);
    }

    //Initialized poisons
    for(let poison of poisons){
        poison.display();
        poison.boundary(controller.plane.width/2,
                      controller.plane.depth/2);
    }
    // Render scene
    renderer.render(scene, camera);
}

animate();