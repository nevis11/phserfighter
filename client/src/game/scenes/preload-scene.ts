import { Scene } from 'phaser';
import { SCENE_KEYS } from "./scene-keys";
import { ASSET_PACK_KEYS, ASSET_KEYS } from "../shared/assets";
import { LevelData } from '../shared/types';
import { DataManager } from '../shared/data-manager';

export class PreloadScene extends Scene {
    //Initailization of Scene
    constructor() {
        super({
            key: SCENE_KEYS.PRELOAD_SCENE,
        });
    };

    public preload(): void {
        console.log('Preloading assets...');
        this.load.pack(ASSET_PACK_KEYS.MAIN, "assets/data/assets.json");
        
        // Add progress tracking
        this.load.on('progress', (value: number) => {
            console.log(`Loading progress: ${(value * 100).toFixed(2)}%`);
        });
        
        this.load.on('complete', () => {
            console.log('Asset loading complete');
        });
    }

    public create(): void {
        this.#createAnimations();
        const sceneData: LevelData = {
            level:DataManager.instance.data.currentArea.name,
            roomId:DataManager.instance.data.currentArea.startRoomId,
            doorId:DataManager.instance.data.currentArea.startDoorId,
        };
        console.log('Starting GameScene with data:', sceneData);
        this.scene.start(SCENE_KEYS.GAME_SCENE, sceneData)
    }

    #createAnimations(): void {
        this.anims.createFromAseprite(ASSET_KEYS.HUD_NUMBERS);
        this.anims.createFromAseprite(ASSET_KEYS.PLAYER);
        this.anims.createFromAseprite(ASSET_KEYS.SPIDER);
        this.anims.createFromAseprite(ASSET_KEYS.WISP);
        this.anims.createFromAseprite(ASSET_KEYS.DROW);
        this.anims.create({
            key: ASSET_KEYS.ENEMY_DEATH,
            frames: this.anims.generateFrameNumbers(ASSET_KEYS.ENEMY_DEATH),
            frameRate: 6,
            repeat: 0,
            delay: 0,
        });
        this.anims.create({
            key: ASSET_KEYS.POT_BREAK,
            frames: this.anims.generateFrameNumbers(ASSET_KEYS.POT_BREAK),
            frameRate: 6,
            repeat: 0,
            delay: 0,
            hideOnComplete: true,
        });
        this.anims.create({
            key: ASSET_KEYS.DAGGER,
            frames: this.anims.generateFrameNumbers(ASSET_KEYS.DAGGER),
            frameRate: 16,
            repeat: -1,
            delay: 0,
        });
    }

}