import { GameScene } from './scenes/game-scene';
import { PreloadScene } from './scenes/preload-scene';
import { Game, Types, WEBGL, Scale } from 'phaser';
import {UiScene} from "./scenes/ui-scene";
import {GameOverScene} from "./scenes/game-over-scene";

const config: Types.Core.GameConfig = {
    type: WEBGL,
    pixelArt: true,
    roundPixels:true,
    scale: {
        parent: "game-container",
        width: 800,
        height: 800,
        autoCenter: Scale.CENTER_BOTH,
        mode: Scale.ScaleModes.HEIGHT_CONTROLS_WIDTH,
        max: { width: 800, height: 800 },
    },
    parent: 'game-container',
    backgroundColor: '#dddddd',
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 0, x: 0 },
            debug: false,
        },  
    },
    scene: [
        PreloadScene,
        GameScene,
        UiScene,
        GameOverScene
    ]
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
}

export default StartGame;
