import { GameScene } from './scenes/game-scene';
import { PreloadScene } from './scenes/preload-scene';
import { Game, Types, WEBGL, Scale } from 'phaser';
import {UiScene} from "./scenes/ui-scene";
import {GameOverScene} from "./scenes/game-over-scene";

const config: Types.Core.GameConfig = {
    type: Phaser.WEBGL,
  pixelArt: true,
  roundPixels: true,
  scale: {
    parent: 'game-container',
    width: 256,
    height: 224,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    mode: Phaser.Scale.HEIGHT_CONTROLS_WIDTH,
  },
  backgroundColor: '#000000',
  physics: {
    default: 'arcade',
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
