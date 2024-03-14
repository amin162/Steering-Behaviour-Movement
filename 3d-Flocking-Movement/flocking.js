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
renderer.shadowMap.enabled = true;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

//Declare dat.gui
const gui = new dat.GUI({ width: 300, height: 400 });

// Setting ground
const groundGeometry = new THREE.BoxGeometry(300, 0.5, 300);
const groundMaterial = new THREE.MeshStandardMaterial({color:0xffffff, side: THREE.DoubleSide});
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
groundMesh.position.y = -5;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

//Setting controller value
const controller = {
    plane: {
        width : groundGeometry.parameters.width,
        depth : groundGeometry.parameters.depth
    },
    flock: {
        align: 1,
        cohere: 1,
        separate: 1
    },
    vision: {
        alignPerception: 100,
        coherePerception: 100,
        separatePerception: 100
    }
};

// Camera position
camera.position.set(0, 100, 250);
camera.lookAt(new THREE.Vector3(0, 0, 0));


// Initialize Light
const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.y = 3;
light.position.z = 2;
// light.castShadow = true;
scene.add(light);

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
        this.maxForce = 0.1;
        this.minForce = 0;

        this.mesh = new THREE.Mesh(
            new THREE.ConeGeometry( 1, 5, 8 ),
            new THREE.MeshStandardMaterial( {color: 0x156289, side: THREE.DoubleSide ,transparent: true} )
        );
        this.mesh.castShadow = true;
        this.mesh.position.copy(this.position);
        scene.add(this.mesh);
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

    updateAngle() {
        const rotationAngleX = Math.atan2
        (
            this.velocity.y, 
            Math.sqrt(this.velocity.x * this.velocity.x + 
                      this.velocity.z * this.velocity.z)
        );
        const rotationAngleZ = Math.atan2
        (
            this.velocity.x, 
            this.velocity.z
        );
        this.mesh.rotation.z = rotationAngleZ + Math.PI;
        this.mesh.rotation.x = rotationAngleX - Math.PI/2;
        this.mesh.position.copy(this.position);
    }
    
    updatePosition() {
        this.position.add(this.velocity);
        this.velocity.add(this.acceleration);
        this.velocity.normalize();
        this.velocity.clampLength(this.minSpeed, this.maxSpeed);
        this.acceleration.multiplyScalar(0);
    }

    update() {
        this.updateAngle();
        this.updatePosition();
    }

    flock(boids) {
        const alignment = this.align(boids);
        const cohesion =  this.cohesion(boids);
        const separation = this.separation(boids);

        alignment.multiplyScalar(controller.flock.align);
        cohesion.multiplyScalar(controller.flock.cohere);
        separation.multiplyScalar(controller.flock.separate);

        this.acceleration.add(alignment);
        this.acceleration.add(cohesion);
        this.acceleration.add(separation);
    }

    seek(boids) {
        const desired = new THREE.Vector3().subVectors(boids,this.position);
        desired.normalize();
        desired.multiplyScalar(this.maxSpeed);
        const steer = new THREE.Vector3().subVectors(desired,this.velocity);
        steer.clampLength(this.minForce,this.maxForce);
        return steer;
    }
    
    align(boids) {
        const perceptorRadius = controller.vision.alignPerception;
        const steer = new THREE.Vector3();
        let count = 0;

        for(const other of boids) {
            const distance = this.position.distanceTo(other.position);

            if(distance > 0 && distance < perceptorRadius) {
                steer.add(other.velocity);
                count++;
            }

            if(count > 0) {
                steer.divideScalar(count);
                steer.normalize();
                steer.multiplyScalar(this.maxSpeed);
                const steering =  new THREE.Vector3().subVectors(steer, this.velocity);
                steering.clampLength(this.minForce, this.maxForce);
                return steering;
            } else {
                return new THREE.Vector3();
            }
                     
        }
    }

    cohesion(boids) {
        const perceptorRadius = controller.vision.coherePerception;
        const steer = new THREE.Vector3();
        let count = 0;

        for(const other of boids) {
            const distance = this.position.distanceTo(other.position);

            if(distance > 0 && distance < perceptorRadius) {
                steer.add(other.position);
                count++
            }
        }

        if (count > 0) {
            steer.divideScalar(count);
            return this.seek(steer);
        } else {
            return steer;
        }

    }

    separation(boids) {
        const perceptorRadius = controller.vision.separatePerception;
        const steer = new THREE.Vector3();
        let count = 0;

        for(const other of boids) {
            const distance = this.position.distanceTo(other.position);

            if(distance > 0 && distance < perceptorRadius) {
                const difference = new THREE.Vector3().subVectors(this.position, other.position)
                difference.normalize();
                difference.divideScalar(distance*distance);
                steer.add(difference);
                count++;
            }           
        }

        if(count > 0) {
            steer.divideScalar(count);
            
        }
        if(steer.length() > 0){
            steer.normalize();
            steer.multiplyScalar(this.maxSpeed);
            steer.sub(this.velocity);

            //Check if the steer magnitude exceeds the maximum
            if(steer.length() > this.maxForce) {
                //Normalize the vector (make it unit vector)
                steer.normalize();

                //Scale the vector to the maximum force
                steer.multiplyScalar(this.maxForce);
            }
        } 
        return steer;
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

// Initialize boid
const boids = [];
for (let i = 0; i < 200; i++) {
    const boid = new Boid(groundGeometry.parameters.width,
                          groundGeometry.parameters.depth);
    boids.push(boid);
}

//Setting movement multiplication
gui.add(controller.flock, "align", 0, 1).step(0.1).name("Align");
gui.add(controller.flock, "cohere", 0, 1).step(0.1).name("Cohere");
gui.add(controller.flock, "separate", 0, 1).step(0.1).name("Separate");

//Setting radius perception
gui.add(controller.vision, "alignPerception", 10, 100).step(1).name("Aligner Perception");
gui.add(controller.vision, "coherePerception", 10, 100).step(1).name("Coherer Perception");
gui.add(controller.vision, "separatePerception", 10, 100).step(1).name("Separator Perception");


// Render loop
function animate() {
    requestAnimationFrame(animate);

    // Update boids
    for (const boid of boids) {
        boid.update();
        boid.boundary(controller.plane.width/2,
                      controller.plane.depth/2);
        boid.flock(boids);
    }

    // Render scene
    renderer.render(scene, camera);
}

animate();

