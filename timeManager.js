import * as THREE from 'three';

export class TimeManager {
    constructor(scene) {
        this.scene = scene;
        this.currentTime = 'noon';
        this.dirLight = scene.children.find(c => c instanceof THREE.Light && c.castShadow);
        this.ambientLight = scene.children.find(c => c instanceof THREE.AmbientLight);
    }

    setTimeOfDay(time) {
        if (this.currentTime === time) return;
        this.currentTime = time;

        const presets = {
            morning: {
                ambientIntensity: 0.6,
                ambientColor: 0xffd9b3,
                dirIntensity: 0.8,
                dirColor: 0xffe4cc,
                dirPosition: { x: 10, y: 8, z: 5 },
                fogColor: 0xb8d4e8,
                skyColor: 0xffccaa
            },
            noon: {
                ambientIntensity: 0.7,
                ambientColor: 0xffffff,
                dirIntensity: 1.0,
                dirColor: 0xffffff,
                dirPosition: { x: 5, y: 15, z: 5 },
                fogColor: 0x87ceeb,
                skyColor: 0x87ceeb
            },
            evening: {
                ambientIntensity: 0.5,
                ambientColor: 0xffa366,
                dirIntensity: 0.7,
                dirColor: 0xffaa66,
                dirPosition: { x: -10, y: 6, z: 5 },
                fogColor: 0xff9966,
                skyColor: 0xffaa88
            },
            night: {
                ambientIntensity: 0.3,
                ambientColor: 0x4466aa,
                dirIntensity: 0.4,
                dirColor: 0x5588dd,
                dirPosition: { x: 5, y: 3, z: 5 },
                fogColor: 0x1a1a2e,
                skyColor: 0x0f0f1e
            }
        };

        const preset = presets[time] || presets.noon;

        // Update ambient light
        if (this.ambientLight) {
            this.ambientLight.intensity = preset.ambientIntensity;
            this.ambientLight.color.setHex(preset.ambientColor);
        }

        // Update directional light
        if (this.dirLight) {
            this.dirLight.intensity = preset.dirIntensity;
            this.dirLight.color.setHex(preset.dirColor);
            this.dirLight.position.set(preset.dirPosition.x, preset.dirPosition.y, preset.dirPosition.z);
        }

        // Update scene background
        this.scene.background.setHex(preset.skyColor);
    }
}