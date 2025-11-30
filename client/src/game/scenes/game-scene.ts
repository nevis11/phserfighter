import * as Phaser from 'phaser';
import { SCENE_KEYS } from './scene-keys';
import { ASSET_KEYS, CHEST_REWARD_TO_TEXTURE_FRAME } from '../shared/assets';
import { Player } from '../game-objects/player/player';
import { KeyboardComponent } from '../components/input/keyboard-component';
import { Spider } from '../game-objects/enemies/spider';
import { Wisp } from '../game-objects/enemies/wisp';
import { CharacterGameObject } from '../game-objects/common/character-game-object';
import { CHEST_REWARD_TO_DIALOG_MAP, DIRECTION, DUNGEON_ITEM } from '../shared/common';
import * as CONFIG from '../shared/config';
import { Pot } from '../game-objects/objects/pot';
import { Chest } from '../game-objects/objects/chest';
import { GameObject, LevelData } from '../shared/types';
import { CUSTOM_EVENTS, EventBus } from '../EventBus';
import {
  exhaustiveGuard,
  getDirectionOfObjectFromAnotherObject,
  isArcadePhysicsBody,
  isLevelName,
} from '../shared/utils';
import { TiledRoomObject } from '../shared/tiled/types';
import {
  CHEST_REWARD,
  DOOR_TYPE,
  SWITCH_ACTION,
  TILED_LAYER_NAMES,
  TILED_TILESET_NAMES,
  TRAP_TYPE,
} from '../shared/tiled/common';
import {
  getAllLayerNamesWithPrefix,
  getTiledChestObjectsFromMap,
  getTiledDoorObjectsFromMap,
  getTiledEnemyObjectsFromMap,
  getTiledPotObjectsFromMap,
  getTiledRoomObjectsFromMap,
  getTiledSwitchObjectsFromMap,
} from '../shared/tiled/tiled-utils';
import { Door } from '../game-objects/objects/door';
import { Button } from '../game-objects/objects/button';
import { InventoryManager } from '../components/inventory/inventory-manager';
import { CHARACTER_STATES } from '../components/state-machine/states/character/character-states';
import { WeaponComponent } from '../components/game-object/weapon-component';
import { DataManager } from '../shared/data-manager';
import { Drow } from '../game-objects/enemies/boss/drow';

export class GameScene extends Phaser.Scene {
  #levelData!: LevelData;
  #controls!: KeyboardComponent;
  #player!: Player;
  #blockingGroup!: Phaser.GameObjects.Group;
  #objectsByRoomId!: {
    [key: number]: {
      chestMap: { [key: number]: Chest };
      doorMap: { [key: number]: Door };
      doors: Door[];
      switches: Button[];
      pots: Pot[];
      chests: Chest[];
      enemyGroup?: Phaser.GameObjects.Group;
      room: TiledRoomObject;
    };
  };
  #collisionLayer!: Phaser.Tilemaps.TilemapLayer;
  #enemyCollisionLayer!: Phaser.Tilemaps.TilemapLayer;
  #doorTransitionGroup!: Phaser.GameObjects.Group;
  #currentRoomId!: number;
  #lockedDoorGroup!: Phaser.GameObjects.Group;
  #switchGroup!: Phaser.GameObjects.Group;
  #rewardItem!: Phaser.GameObjects.Image;

  /**
   * Mint an NFT loot item when a chest is opened
   */
  #mintLootFromChest(chestContents: keyof typeof DUNGEON_ITEM): void {
    // Only mint if the window function is available (wallet connected)
    if (typeof (window as any).mintLootFromGame === 'function') {
      // Map chest contents to loot type
      let lootType = 'sword'; // default
      
      switch (chestContents) {
        case DUNGEON_ITEM.MAP:
        case DUNGEON_ITEM.COMPASS:
          lootType = 'sword';
          break;
        case DUNGEON_ITEM.SMALL_KEY:
        case DUNGEON_ITEM.BOSS_KEY:
          lootType = 'key';
          break;
        default:
          lootType = 'sword';
      }
      
      // Call the minting function (this will be handled by the web3 integration)
      try {
        (window as any).mintLootFromGame(lootType);
      } catch (error) {
        console.error('Error minting loot NFT:', error);
      }
    }
  }

  constructor() {
    super({
      key: SCENE_KEYS.GAME_SCENE,
    });
  }

  get player(): Player {
    return this.#player;
  }

  public init(data: LevelData): void {
    this.#levelData = data;
    this.#currentRoomId = data.roomId;
  }

  public create(): void {
    console.log('[GameScene] create method called');
    console.log('[GameScene] Scene dimensions:', this.scale.width, 'x', this.scale.height);
    console.log('[GameScene] Game canvas:', this.game.canvas);
    
    if (!this.input.keyboard) {
      console.warn('[GameScene] Phaser keyboard plugin is not setup properly.');
      return;
    }
    this.#controls = new KeyboardComponent(this.input.keyboard);

    console.log('[GameScene] Creating level...');
    try {
      this.#createLevel();
      if (this.#collisionLayer === undefined || this.#enemyCollisionLayer === undefined) {
        console.warn('[GameScene] Missing required collision layers for game.');
        // Continue anyway to show the background
      }
    } catch (error) {
      console.error('[GameScene] Error creating level:', error);
      // Continue anyway to show the background
    }

    console.log('[GameScene] Showing objects in room...');
    try {
      console.log('[GameScene] objectsByRoomId state:', this.#objectsByRoomId);
      // Only show objects if they were created successfully
      // Add proper null check before accessing this.#objectsByRoomId
      if (this.#objectsByRoomId && typeof this.#objectsByRoomId === 'object' && Object.keys(this.#objectsByRoomId).length > 0) {
        this.#showObjectsInRoomById(this.#levelData.roomId);
      } else {
        console.log('[GameScene] Skipping object display - no objects created');
      }
    } catch (error) {
      console.error('[GameScene] Error showing objects in room:', error);
    }
    
    console.log('[GameScene] Setting up player...');
    this.#setupPlayer();
    
    console.log('[GameScene] Setting up camera...');
    this.#setupCamera();
    
    this.#rewardItem = this.add.image(0, 0, ASSET_KEYS.UI_ICONS, 0).setVisible(false).setOrigin(0, 1);

    console.log('[GameScene] Registering colliders...');
    this.#registerColliders();
    
    console.log('[GameScene] Registering custom events...');
    this.#registerCustomEvents();

    console.log('[GameScene] Launching UI scene...');
    this.scene.launch(SCENE_KEYS.UI_SCENE);

    console.log('[GameScene] Setting up resize listener...');
    this.scale.on(Phaser.Scale.Events.RESIZE, this.#onResize, this);
    
    console.log('[GameScene] Scene creation complete');
    console.log('[GameScene] Scene children count:', this.children.length);
  }

  #registerColliders(): void {
    try {
      // Only register colliders if collision layers exist
      if (this.#collisionLayer && this.#enemyCollisionLayer) {
        // collision between player and map walls
        this.#collisionLayer.setCollision([this.#collisionLayer.tileset[0].firstgid]);
        this.#enemyCollisionLayer.setCollision([this.#collisionLayer.tileset[0].firstgid]);
        this.physics.add.collider(this.#player, this.#collisionLayer);
      }

      // collision between player and game objects in the dungeon/room/world
      this.physics.add.overlap(this.#player, this.#doorTransitionGroup, (playerObj, doorObj) => {
        this.#handleRoomTransition(doorObj as Phaser.Types.Physics.Arcade.GameObjectWithBody);
      });

      // register collisions between player and blocking game objects (doors, pots, chests, etc.)
      this.physics.add.collider(this.#player, this.#blockingGroup, (player, gameObject) => {
        // add game object to players collision list
        this.#player.collidedWithGameObject(gameObject as GameObject);
      });

      // collision between player and switches that can be stepped on
      this.physics.add.overlap(this.#player, this.#switchGroup, (playerObj, switchObj) => {
        this.#handleButtonPress(switchObj as Button);
      });

      // collision between player and doors that can be unlocked
      this.physics.add.collider(this.#player, this.#lockedDoorGroup, (player, gameObject) => {
        const doorObject = gameObject as Phaser.Types.Physics.Arcade.GameObjectWithBody;
        // Check if objectsByRoomId exists before accessing
        if (this.#objectsByRoomId && this.#objectsByRoomId[this.#currentRoomId]) {
          const door = this.#objectsByRoomId[this.#currentRoomId].doorMap[doorObject.name as any] as Door;

          if (door && (door.doorType === DOOR_TYPE.LOCK || door.doorType === DOOR_TYPE.BOSS)) {
            const areaInventory = InventoryManager.instance.getAreaInventory(this.#levelData.level);
            if (door.doorType === DOOR_TYPE.LOCK) {
              if (areaInventory.keys > 0) {
                InventoryManager.instance.useAreaSmallKey(this.#levelData.level);
                door.open();
                // update data manager so we can persist door state
                DataManager.instance.updateDoorData(this.#currentRoomId, door.id, true);
              }
              return;
            }

            // handle boss door
            if (areaInventory.bossKey) {
              // update data manager so we can persist door state
              DataManager.instance.updateDoorData(this.#currentRoomId, door.id, true);
              door.open();
            }
          }
        }
      });

      // collisions between enemy groups, collision layers, player, player weapon, and blocking items (pots, chests, etc)
      // Add proper null check for this.#objectsByRoomId
      if (this.#objectsByRoomId && typeof this.#objectsByRoomId === 'object') {
        Object.keys(this.#objectsByRoomId).forEach((key) => {
          const roomId = parseInt(key, 10);
          // Add additional null check for the room data
          if (this.#objectsByRoomId[roomId] === undefined) {
            return;
          }

          if (this.#objectsByRoomId[roomId].enemyGroup !== undefined) {
            // collide with walls, doors, etc (only if enemy collision layer exists)
            if (this.#enemyCollisionLayer) {
              this.physics.add.collider(this.#objectsByRoomId[roomId].enemyGroup, this.#enemyCollisionLayer);
            }

            // register collisions between player and enemies
            this.physics.add.overlap(this.#player, this.#objectsByRoomId[roomId].enemyGroup, () => {
              this.#player.hit(DIRECTION.DOWN, 1);
            });

            // register collisions between enemies and blocking game objects (doors, pots, chests, etc.)
            this.physics.add.collider(
              this.#objectsByRoomId[roomId].enemyGroup,
              this.#blockingGroup,
              (enemy, gameObject) => {
                // handle when pot objects are thrown at enemies
                if (
                  gameObject instanceof Pot &&
                  isArcadePhysicsBody(gameObject.body) &&
                  (gameObject.body.velocity.x !== 0 || gameObject.body.velocity.y !== 0)
                ) {
                  const enemyGameObject = enemy as CharacterGameObject;
                  if (enemyGameObject instanceof CharacterGameObject) {
                    enemyGameObject.hit(this.#player.direction, 1);
                    gameObject.break();
                  }
                }
              },
              // handle when objects are thrown on wisps, ignore collisions and let object move through
              (enemy, gameObject) => {
                const body = (gameObject as unknown as GameObject).body;
                if (
                  enemy instanceof Wisp &&
                  isArcadePhysicsBody(body) &&
                  (body.velocity.x !== 0 || body.velocity.y !== 0)
                ) {
                  return false;
                }
                return true;
              },
            );

            // register collisions between player weapon and enemies
            this.physics.add.overlap(
              this.#objectsByRoomId[roomId].enemyGroup,
              this.#player.weaponComponent.body,
              (enemy) => {
                (enemy as CharacterGameObject).hit(this.#player.direction, this.#player.weaponComponent.weaponDamage);
              },
            );

            // register collisions between enemy weapon and player
            const enemyWeapons = this.#objectsByRoomId[roomId].enemyGroup.getChildren().flatMap((enemy) => {
              const weaponComponent = WeaponComponent.getComponent<WeaponComponent>(enemy as GameObject);
              if (weaponComponent !== undefined) {
                return [weaponComponent.body];
              }
              return [];
            });
            if (enemyWeapons.length > 0) {
              this.physics.add.overlap(enemyWeapons, this.#player, (enemyWeaponBody) => {
                // get associated weapon component so we can do things like hide projectiles and disable collisions
                const weaponComponent = WeaponComponent.getComponent<WeaponComponent>(enemyWeaponBody as GameObject);
                if (weaponComponent === undefined || weaponComponent.weapon === undefined) {
                  return;
                }
                weaponComponent.weapon.onCollisionCallback();
                this.#player.hit(DIRECTION.DOWN, weaponComponent.weaponDamage);
              });
            }
          }

          // handle collisions between thrown pots and other objects in the current room
          // Add null check for pots array
          if (this.#objectsByRoomId[roomId].pots && this.#objectsByRoomId[roomId].pots.length > 0) {
            this.physics.add.collider(this.#objectsByRoomId[roomId].pots, this.#blockingGroup, (pot) => {
              if (!(pot instanceof Pot)) {
                return;
              }
              pot.break();
            });
            // collisions between pots and collision layer (only if collision layer exists)
            if (this.#collisionLayer) {
              this.physics.add.collider(this.#objectsByRoomId[roomId].pots, this.#collisionLayer, (pot) => {
                if (!(pot instanceof Pot)) {
                  return;
                }
                pot.break();
              });
            }
          }
        });
      }
    } catch (error) {
      console.error('[GameScene] Error registering colliders:', error);
    }
  }

  #registerCustomEvents(): void {
    EventBus.on(CUSTOM_EVENTS.OPENED_CHEST, this.#handleOpenChest, this);
    EventBus.on(CUSTOM_EVENTS.QUIZ_ANSWERED, this.#handleQuizAnswered, this);
    EventBus.on(CUSTOM_EVENTS.ENEMY_DESTROYED, this.#checkForAllEnemiesAreDefeated, this);
    EventBus.on(CUSTOM_EVENTS.PLAYER_DEFEATED, this.#handlePlayerDefeatedEvent, this);
    EventBus.on(CUSTOM_EVENTS.DIALOG_CLOSED, this.#handleDialogClosed, this);
    EventBus.on(CUSTOM_EVENTS.BOSS_DEFEATED, this.#handleBossDefeated, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(CUSTOM_EVENTS.OPENED_CHEST, this.#handleOpenChest, this);
      EventBus.off(CUSTOM_EVENTS.QUIZ_ANSWERED, this.#handleQuizAnswered, this);
      EventBus.off(CUSTOM_EVENTS.ENEMY_DESTROYED, this.#checkForAllEnemiesAreDefeated, this);
      EventBus.off(CUSTOM_EVENTS.PLAYER_DEFEATED, this.#handlePlayerDefeatedEvent, this);
      EventBus.off(CUSTOM_EVENTS.DIALOG_CLOSED, this.#handleDialogClosed, this);
      EventBus.off(CUSTOM_EVENTS.BOSS_DEFEATED, this.#handleBossDefeated, this);
    });
  }

  #pendingKeyChest?: Chest;

  #handleOpenChest(chest: Chest): void {
    if (chest.contents === DUNGEON_ITEM.SMALL_KEY) {
      this.#pendingKeyChest = chest;
      EventBus.emit(CUSTOM_EVENTS.SHOW_QUIZ);
      return;
    }

    this.#pendingKeyChest = undefined;
    DataManager.instance.updateChestData(this.#currentRoomId, chest.id, true, true);

    if (chest.contents !== CHEST_REWARD.NOTHING) {
      InventoryManager.instance.addDungeonItem(this.#levelData.level, chest.contents);
      
      // Mint NFT when chest is opened (only once per chest)
      this.#mintLootFromChest(chest.contents);
    }

    this.#rewardItem
      .setFrame(CHEST_REWARD_TO_TEXTURE_FRAME[chest.contents])
      .setVisible(true)
      .setPosition(chest.x, chest.y);

    this.tweens.add({
      targets: this.#rewardItem,
      y: this.#rewardItem.y - 16,
      duration: 500,
      onComplete: () => {
        EventBus.emit(CUSTOM_EVENTS.SHOW_DIALOG, CHEST_REWARD_TO_DIALOG_MAP[chest.contents]);
        this.scene.pause();
      },
    });
  }

  #handleQuizAnswered = (data: { correct: boolean }): void => {
    if (!this.#pendingKeyChest) {
      return;
    }

    const chest = this.#pendingKeyChest;

    if (!data.correct) {
      EventBus.emit(CUSTOM_EVENTS.SHOW_QUIZ);
      return;
    }

    DataManager.instance.updateChestData(this.#currentRoomId, chest.id, true, true);
    if (chest.contents !== CHEST_REWARD.NOTHING) {
      InventoryManager.instance.addDungeonItem(this.#levelData.level, chest.contents);
    }

    this.#rewardItem
      .setFrame(CHEST_REWARD_TO_TEXTURE_FRAME[chest.contents])
      .setVisible(true)
      .setPosition(chest.x, chest.y);

    this.tweens.add({
      targets: this.#rewardItem,
      y: this.#rewardItem.y - 16,
      duration: 500,
      onComplete: () => {
        EventBus.emit(CUSTOM_EVENTS.SHOW_DIALOG, CHEST_REWARD_TO_DIALOG_MAP[chest.contents]);
        this.scene.pause();
      },
    });
  };

  #createLevel(): void {
    console.log('[GameScene] Creating level with data:', this.#levelData);
    console.log('[GameScene] Background key:', ASSET_KEYS[`${this.#levelData.level}_BACKGROUND`]);
    console.log('[GameScene] Foreground key:', ASSET_KEYS[`${this.#levelData.level}_FOREGROUND`]);
    
    // Add a solid colored background as fallback
    const fallbackBg = this.add.rectangle(0, 0, 2000, 2000, 0x222222).setOrigin(0).setDepth(-10);
    console.log('[GameScene] Fallback background created:', fallbackBg);
    
    // create main background
    const background = this.add.image(0, 0, ASSET_KEYS[`${this.#levelData.level}_BACKGROUND`], 0).setOrigin(0);
    console.log('[GameScene] Background created:', background);
    console.log('[GameScene] Background visible:', background.visible, 'Alpha:', background.alpha);
    
    // create main foreground
    const foreground = this.add.image(0, 0, ASSET_KEYS[`${this.#levelData.level}_FOREGROUND`], 0).setOrigin(0).setDepth(2);
    console.log('[GameScene] Foreground created:', foreground);
    console.log('[GameScene] Foreground visible:', foreground.visible, 'Alpha:', foreground.alpha);

    // create tilemap from Tiled json data
    console.log('[GameScene] Creating tilemap with key:', ASSET_KEYS[`${this.#levelData.level}_LEVEL`]);
    let map;
    try {
      map = this.make.tilemap({
        key: ASSET_KEYS[`${this.#levelData.level}_LEVEL`],
      });
      console.log('[GameScene] Tilemap created:', map);
    } catch (error) {
      console.error('[GameScene] Failed to create tilemap:', error);
      // Create a fallback tilemap or continue without it
      console.log('[GameScene] Continuing without tilemap due to error');
      return;
    }

    try {
      // The first parameter is the name of the tileset in Tiled and the second parameter is the key
      // of the tileset image used when loading the file in preload.
      const collisionTiles = map.addTilesetImage(TILED_TILESET_NAMES.COLLISION, ASSET_KEYS.COLLISION);
      if (collisionTiles === null) {
        console.log(`[GameScene] encountered error while creating collision tiles from tiled`);
        return;
      }

      const collisionLayer = map.createLayer(TILED_LAYER_NAMES.COLLISION, collisionTiles, 0, 0);
      if (collisionLayer === null) {
        console.log(`[GameScene] encountered error while creating collision layer using data from tiled`);
        return;
      }
      this.#collisionLayer = collisionLayer;
      this.#collisionLayer.setDepth(2).setAlpha(CONFIG.DEBUG_COLLISION_ALPHA);

      const enemyCollisionLayer = map.createLayer(TILED_LAYER_NAMES.ENEMY_COLLISION, collisionTiles, 0, 0);
      if (enemyCollisionLayer === null) {
        console.log(`[GameScene] encountered error while creating enemy collision layer using data from tiled`);
        return;
      }
      this.#enemyCollisionLayer = enemyCollisionLayer;
      this.#enemyCollisionLayer.setDepth(2).setVisible(false);
    } catch (error) {
      console.error('[GameScene] Error setting up tilemap layers:', error);
      console.log('[GameScene] Continuing without tilemap layers');
      return;
    }

    try {
      // initialize objects
      this.#objectsByRoomId = {};
      this.#doorTransitionGroup = this.add.group([]);
      this.#blockingGroup = this.add.group([]);
      this.#lockedDoorGroup = this.add.group([]);
      this.#switchGroup = this.add.group([]);

      // create game objects
      this.#createRooms(map, TILED_LAYER_NAMES.ROOMS);

      const rooms = getAllLayerNamesWithPrefix(map, TILED_LAYER_NAMES.ROOMS).map((layerName: string) => {
        return {
          name: layerName,
          roomId: parseInt(layerName.split('/')[1], 10),
        };
      });
      const switchLayerNames = rooms.filter((layer) => layer.name.endsWith(`/${TILED_LAYER_NAMES.SWITCHES}`));
      const potLayerNames = rooms.filter((layer) => layer.name.endsWith(`/${TILED_LAYER_NAMES.POTS}`));
      const doorLayerNames = rooms.filter((layer) => layer.name.endsWith(`/${TILED_LAYER_NAMES.DOORS}`));
      const chestLayerNames = rooms.filter((layer) => layer.name.endsWith(`/${TILED_LAYER_NAMES.CHESTS}`));
      const enemyLayerNames = rooms.filter((layer) => layer.name.endsWith(`/${TILED_LAYER_NAMES.ENEMIES}`));

      doorLayerNames.forEach((layer) => this.#createDoors(map, layer.name, layer.roomId));
      switchLayerNames.forEach((layer) => this.#createButtons(map, layer.name, layer.roomId));
      potLayerNames.forEach((layer) => this.#createPots(map, layer.name, layer.roomId));
      chestLayerNames.forEach((layer) => this.#createChests(map, layer.name, layer.roomId));
      enemyLayerNames.forEach((layer) => this.#createEnemies(map, layer.name, layer.roomId));
    } catch (error) {
      console.error('[GameScene] Error creating game objects:', error);
      console.log('[GameScene] Continuing without game objects');
      return;
    }
  }

  #setupCamera(): void {
    try {
      console.log('[GameScene] Setting up camera...');
      
      // Check if objectsByRoomId and room exist before accessing
      if (!this.#objectsByRoomId || !this.#objectsByRoomId[this.#levelData.roomId] || 
          !this.#objectsByRoomId[this.#levelData.roomId].room) {
        console.warn('[GameScene] Room data not available for camera setup');
        // Set default camera settings
        this.cameras.main.setZoom(1);
        if (this.#player) {
          this.cameras.main.startFollow(this.#player);
        }
        this.cameras.main.setBackgroundColor('#000000');
        return;
      }
      
      const roomSize = this.#objectsByRoomId[this.#levelData.roomId].room;
      console.log('[GameScene] Setting up camera with room size:', roomSize);
      
      // Set camera bounds with proper offset for the room
      this.cameras.main.setBounds(
        roomSize.x,
        roomSize.y - roomSize.height,
        roomSize.width,
        roomSize.height
      );
      
      // Calculate zoom to fit room with a small margin
      const canvasW = this.scale.width;
      const canvasH = this.scale.height;
      const zoomX = (canvasW * 0.95) / roomSize.width;
      const zoomY = (canvasH * 0.95) / roomSize.height;
      const zoom = Math.min(zoomX, zoomY);
      
      console.log('[GameScene] Calculated zoom:', zoom);
      
      this.cameras.main.setZoom(zoom);
      this.cameras.main.startFollow(this.#player);
    } catch (error) {
      console.error('[GameScene] Error setting up camera:', error);
      // Set default camera settings
      this.cameras.main.setZoom(1);
      if (this.#player) {
        this.cameras.main.startFollow(this.#player);
      }
    }
    
    // Ensure background covers the entire camera view
    this.cameras.main.setBackgroundColor('#000000');
    
    // Also set a global background as fallback
    if (this.game && this.game.canvas) {
      this.game.canvas.style.backgroundColor = '#000000';
    }
  }

  #onResize(): void {
    try {
      // Check if objectsByRoomId and room exist before accessing
      if (!this.#objectsByRoomId || !this.#objectsByRoomId[this.#currentRoomId] || 
          !this.#objectsByRoomId[this.#currentRoomId].room) {
        console.warn('[GameScene] Room data not available for resize');
        return;
      }
      
      const roomSize = this.#objectsByRoomId[this.#currentRoomId].room;
      const canvasW = this.scale.width;
      const canvasH = this.scale.height;
      const zoomX = (canvasW * 0.95) / roomSize.width;
      const zoomY = (canvasH * 0.95) / roomSize.height;
      const zoom = Math.min(zoomX, zoomY);
      this.cameras.main.setZoom(zoom);
      this.cameras.main.setBounds(roomSize.x, roomSize.y - roomSize.height, roomSize.width, roomSize.height);
    } catch (error) {
      console.error('[GameScene] Error handling resize:', error);
    }
  }

  #setupPlayer(): void {
    console.log('[GameScene] Setting up player...');
    
    try {
      // Check if objectsByRoomId and doorMap exist before accessing
      if (!this.#objectsByRoomId || !this.#objectsByRoomId[this.#levelData.roomId] || 
          !this.#objectsByRoomId[this.#levelData.roomId].doorMap) {
        console.warn('[GameScene] Room data or door map not available, creating player at default position');
        this.#player = new Player({
          scene: this,
          position: { x: 400, y: 300 },
          controls: this.#controls,
          maxLife: CONFIG.PLAYER_START_MAX_HEALTH,
          currentLife: CONFIG.PLAYER_START_MAX_HEALTH,
        });
        console.log('[GameScene] Player created at default position:', this.#player);
        return;
      }
      
      const startingDoor = this.#objectsByRoomId[this.#levelData.roomId].doorMap[this.#levelData.doorId];
      if (!startingDoor) {
        console.warn('[GameScene] Starting door not found, creating player at default position');
        this.#player = new Player({
          scene: this,
          position: { x: 400, y: 300 },
          controls: this.#controls,
          maxLife: CONFIG.PLAYER_START_MAX_HEALTH,
          currentLife: CONFIG.PLAYER_START_MAX_HEALTH,
        });
        console.log('[GameScene] Player created at default position:', this.#player);
        return;
      }
      
      console.log('[GameScene] Starting door:', startingDoor);
      
      const playerStartPosition = {
        x: startingDoor.x + startingDoor.doorTransitionZone.width / 2,
        y: startingDoor.y - startingDoor.doorTransitionZone.height / 2,
      };
      
      console.log('[GameScene] Initial player position:', playerStartPosition);
      
      switch (startingDoor.direction) {
        case DIRECTION.UP:
          playerStartPosition.y += 40;
          break;
        case DIRECTION.DOWN:
          playerStartPosition.y -= 40;
          break;
        case DIRECTION.LEFT:
          playerStartPosition.x += 40;
          break;
        case DIRECTION.RIGHT:
          playerStartPosition.x -= 40;
          break;
        default:
          exhaustiveGuard(startingDoor.direction);
      }
      
      console.log('[GameScene] Adjusted player position:', playerStartPosition);

      this.#player = new Player({
        scene: this,
        position: { x: playerStartPosition.x, y: playerStartPosition.y },
        controls: this.#controls,
        maxLife: CONFIG.PLAYER_START_MAX_HEALTH,
        currentLife: CONFIG.PLAYER_START_MAX_HEALTH,
      });
      
      console.log('[GameScene] Player created:', this.#player);
    } catch (error) {
      console.error('[GameScene] Error setting up player:', error);
      // Create player at default position as fallback
      this.#player = new Player({
        scene: this,
        position: { x: 400, y: 300 },
        controls: this.#controls,
        maxLife: CONFIG.PLAYER_START_MAX_HEALTH,
        currentLife: CONFIG.PLAYER_START_MAX_HEALTH,
      });
      console.log('[GameScene] Player created at default position due to error:', this.#player);
    }
  }

  /**
   * Parses the Tiled Map data and creates the 'Room' game objects
   * from the rooms layer in Tiled. The `Room` object is how we group
   * the various game objects in our game.
   */
  #createRooms(map: Phaser.Tilemaps.Tilemap, layerName: string): void {
    const validTiledObjects = getTiledRoomObjectsFromMap(map, layerName);
    validTiledObjects.forEach((tiledObject) => {
      this.#objectsByRoomId[tiledObject.id] = {
        switches: [],
        pots: [],
        doors: [],
        chests: [],
        room: tiledObject,
        chestMap: {},
        doorMap: {},
      };
    });
  }

  /**
   * Parses the Tiled Map data and creates the 'Door' game objects
   * for transitions between the various rooms/caves/buildings/etc.
   */
  #createDoors(map: Phaser.Tilemaps.Tilemap, layerName: string, roomId: number): void {
    const validTiledObjects = getTiledDoorObjectsFromMap(map, layerName);
    validTiledObjects.forEach((tileObject) => {
      const door = new Door(this, tileObject, roomId);
      this.#objectsByRoomId[roomId].doors.push(door);
      this.#objectsByRoomId[roomId].doorMap[tileObject.id] = door;
      this.#doorTransitionGroup.add(door.doorTransitionZone);

      if (door.doorObject === undefined) {
        return;
      }

      // update door details based on data in data manager
      const existingDoorData =
        DataManager.instance.data.areaDetails[DataManager.instance.data.currentArea.name][roomId]?.doors[tileObject.id];
      if (existingDoorData !== undefined && existingDoorData.unlocked) {
        door.open();
        return;
      }

      // if door is a locked door, use different group so we during collision we can unlock door if able
      if (door.doorType === DOOR_TYPE.LOCK || door.doorType === DOOR_TYPE.BOSS) {
        this.#lockedDoorGroup.add(door.doorObject);
        return;
      }

      this.#blockingGroup.add(door.doorObject);
    });
  }

  /**
   * Parses the Tiled Map data and creates the 'Button' game objects
   * that players can interact with to open doors, reveal chests, etc.
   */
  #createButtons(map: Phaser.Tilemaps.Tilemap, layerName: string, roomId: number): void {
    const validTiledObjects = getTiledSwitchObjectsFromMap(map, layerName);
    validTiledObjects.forEach((tileObject) => {
      const button = new Button(this, tileObject);
      this.#objectsByRoomId[roomId].switches.push(button);
      this.#switchGroup.add(button);
    });
  }

  /**
   * Parses the Tiled Map data and creates the 'Pot' game objects.
   */
  #createPots(map: Phaser.Tilemaps.Tilemap, layerName: string, roomId: number): void {
    const validTiledObjects = getTiledPotObjectsFromMap(map, layerName);
    validTiledObjects.forEach((tiledObject) => {
      const pot = new Pot(this, tiledObject);
      this.#objectsByRoomId[roomId].pots.push(pot);
      this.#blockingGroup.add(pot);
    });
  }

  /**
   * Parses the Tiled Map data and creates the 'Chest' game objects.
   */
  #createChests(map: Phaser.Tilemaps.Tilemap, layerName: string, roomId: number): void {
    const validTiledObjects = getTiledChestObjectsFromMap(map, layerName);
    validTiledObjects.forEach((tiledObject) => {
      const chest = new Chest(this, tiledObject);
      this.#objectsByRoomId[roomId].chests.push(chest);
      this.#objectsByRoomId[roomId].chestMap[chest.id] = chest;
      this.#blockingGroup.add(chest);

      // update chest details based on data in data manager
      const existingChestData =
        DataManager.instance.data.areaDetails[DataManager.instance.data.currentArea.name][roomId]?.chests[
          tiledObject.id
        ];
      if (existingChestData !== undefined) {
        if (existingChestData.revealed) {
          chest.reveal();
        }
        if (existingChestData.opened) {
          chest.open();
        }
      }
    });
  }

  /**
   * Parses the Tiled Map data and creates the various enemy game objects like 'Wisp' and 'Spider'.
   */
  #createEnemies(map: Phaser.Tilemaps.Tilemap, layerName: string, roomId: number): void {
    if (this.#objectsByRoomId[roomId].enemyGroup === undefined) {
      this.#objectsByRoomId[roomId].enemyGroup = this.add.group([], {
        runChildUpdate: true,
      });
    }
    const validTiledObjects = getTiledEnemyObjectsFromMap(map, layerName);
    for (const tiledObject of validTiledObjects) {
      if (tiledObject.type !== 1 && tiledObject.type !== 2 && tiledObject.type !== 3) {
        continue;
      }
      if (tiledObject.type === 1) {
        const spider = new Spider({ scene: this, position: { x: tiledObject.x, y: tiledObject.y } });
        this.#objectsByRoomId[roomId].enemyGroup.add(spider);
        continue;
      }
      if (tiledObject.type === 2) {
        const wisp = new Wisp({ scene: this, position: { x: tiledObject.x, y: tiledObject.y } });
        this.#objectsByRoomId[roomId].enemyGroup.add(wisp);
        continue;
      }
      if (
        tiledObject.type === 3 &&
        !DataManager.instance.data.areaDetails[DataManager.instance.data.currentArea.name].bossDefeated
      ) {
        const drow = new Drow({ scene: this, position: { x: tiledObject.x, y: tiledObject.y } });
        this.#objectsByRoomId[roomId].enemyGroup.add(drow);
        continue;
      }
    }
  }

  #handleRoomTransition(doorTrigger: Phaser.Types.Physics.Arcade.GameObjectWithBody): void {
    // lock player input until transition is finished
    this.#controls.isMovementLocked = true;

    const door = this.#objectsByRoomId[this.#currentRoomId].doorMap[doorTrigger.name as any] as Door;
    const modifiedLevelName = door.targetLevel.toUpperCase();
    if (isLevelName(modifiedLevelName)) {
      const sceneData: LevelData = {
        level: modifiedLevelName,
        roomId: door.targetRoomId,
        doorId: door.targetDoorId,
      };
      this.scene.start(SCENE_KEYS.GAME_SCENE, sceneData);
      return;
    }
    const targetDoor = this.#objectsByRoomId[door.targetRoomId].doorMap[door.targetDoorId];

    // disable body on game object so we stop triggering the collision
    door.disableObject();
    // update 2nd room to have items visible
    this.#showObjectsInRoomById(targetDoor.roomId);
    // disable body on target door so we don't trigger transition back to original room
    targetDoor.disableObject();

    // go to idle state
    this.#player.stateMachine.setState(CHARACTER_STATES.IDLE_STATE);

    // calculate the target door and direction so we can animate the player and camera properly
    const targetDirection = getDirectionOfObjectFromAnotherObject(door, targetDoor);
    const doorDistance = {
      x: Math.abs((door.doorTransitionZone.x - targetDoor.doorTransitionZone.x) / 2),
      y: Math.abs((door.doorTransitionZone.y - targetDoor.doorTransitionZone.y) / 2),
    };
    if (targetDirection === DIRECTION.UP) {
      doorDistance.y *= -1;
    }
    if (targetDirection === DIRECTION.LEFT) {
      doorDistance.x *= -1;
    }

    // animate player into hallway
    const playerTargetPosition = {
      x: door.x + door.doorTransitionZone.width / 2 + doorDistance.x,
      y: door.y - door.doorTransitionZone.height / 2 + doorDistance.y,
    };
    this.tweens.add({
      targets: this.#player,
      y: playerTargetPosition.y,
      x: playerTargetPosition.x,
      duration: CONFIG.ROOM_TRANSITION_PLAYER_INTO_HALL_DURATION,
      delay: CONFIG.ROOM_TRANSITION_PLAYER_INTO_HALL_DELAY,
    });

    const roomSize = this.#objectsByRoomId[targetDoor.roomId].room;
    this.cameras.main.setBounds(
      this.cameras.main.worldView.x,
      this.cameras.main.worldView.y,
      this.cameras.main.worldView.width,
      this.cameras.main.worldView.height,
    );
    this.cameras.main.stopFollow();
    const bounds = this.cameras.main.getBounds();
    const canvasW = this.scale.width;
    const canvasH = this.scale.height;
    const zoomX = canvasW / roomSize.width;
    const zoomY = canvasH / roomSize.height;
    const targetZoom = Math.min(zoomX, zoomY);
    this.cameras.main.setZoom(targetZoom);
    this.tweens.add({
      targets: bounds,
      x: roomSize.x,
      y: roomSize.y - roomSize.height,
      duration: CONFIG.ROOM_TRANSITION_CAMERA_ANIMATION_DURATION,
      delay: CONFIG.ROOM_TRANSITION_CAMERA_ANIMATION_DELAY,
      onUpdate: () => {
        this.cameras.main.setBounds(bounds.x, bounds.y, roomSize.width, roomSize.height);
      },
    });

    // animate player into room
    const playerDistanceToMoveIntoRoom = {
      x: doorDistance.x * 2,
      y: doorDistance.y * 2,
    };
    if (targetDirection === DIRECTION.UP || targetDirection === DIRECTION.DOWN) {
      playerDistanceToMoveIntoRoom.y = Math.max(Math.abs(playerDistanceToMoveIntoRoom.y), 32);
      if (targetDirection === DIRECTION.UP) {
        playerDistanceToMoveIntoRoom.y *= -1;
      }
    } else {
      playerDistanceToMoveIntoRoom.x = Math.max(Math.abs(playerDistanceToMoveIntoRoom.x), 32);
      if (targetDirection === DIRECTION.LEFT) {
        playerDistanceToMoveIntoRoom.x *= -1;
      }
    }

    this.tweens.add({
      targets: this.#player,
      y: playerTargetPosition.y + playerDistanceToMoveIntoRoom.y,
      x: playerTargetPosition.x + playerDistanceToMoveIntoRoom.x,
      duration: CONFIG.ROOM_TRANSITION_PLAYER_INTO_NEXT_ROOM_DURATION,
      delay: CONFIG.ROOM_TRANSITION_PLAYER_INTO_NEXT_ROOM_DELAY,
      onComplete: () => {
        // re-enable the door object player just entered through
        targetDoor.enableObject();
        // disable objects in previous room and repopulate this room if needed
        this.#hideObjectsInRoomById(door.roomId);
        this.#currentRoomId = targetDoor.roomId;
        this.#checkForAllEnemiesAreDefeated();
        // update camera to follow player again
        this.cameras.main.startFollow(this.#player);
        // re-enable player input
        this.#controls.isMovementLocked = false;
      },
    });
  }

  #handleButtonPress(button: Button): void {
    const buttonPressedData = button.press();
    if (buttonPressedData.targetIds.length === 0 || buttonPressedData.action === SWITCH_ACTION.NOTHING) {
      return;
    }
    switch (buttonPressedData.action) {
      case SWITCH_ACTION.OPEN_DOOR:
        // for each door id in the target list, we need to trigger opening the door
        buttonPressedData.targetIds.forEach((id) => this.#objectsByRoomId[this.#currentRoomId].doorMap[id].open());
        break;
      case SWITCH_ACTION.REVEAL_CHEST:
        // for each chest id in the target list, we need to trigger revealing the chest
        buttonPressedData.targetIds.forEach((id) => {
          this.#objectsByRoomId[this.#currentRoomId].chestMap[id].reveal();
          // update data manager so we can persist chest state
          const existingChestData =
            DataManager.instance.data.areaDetails[DataManager.instance.data.currentArea.name][this.#currentRoomId]
              ?.chests[id];
          if (!existingChestData || !existingChestData.revealed) {
            DataManager.instance.updateChestData(this.#currentRoomId, id, true, false);
          }
        });
        break;
      case SWITCH_ACTION.REVEAL_KEY:
        break;
      default:
        exhaustiveGuard(buttonPressedData.action);
    }
  }

  #checkForAllEnemiesAreDefeated(): void {
    const enemyGroup = this.#objectsByRoomId[this.#currentRoomId].enemyGroup;
    if (enemyGroup === undefined) {
      return;
    }

    const allRequiredEnemiesDefeated = enemyGroup.getChildren().every((child) => {
      if (!child.active) {
        return true;
      }
      if (child instanceof Wisp) {
        return true;
      }
      return false;
    });
    if (allRequiredEnemiesDefeated) {
      this.#handleAllEnemiesDefeated();
    }
  }

  #handleAllEnemiesDefeated(): void {
    // check to see if any chests, keys, or doors should be revealed/open
    this.#objectsByRoomId[this.#currentRoomId].chests.forEach((chest) => {
      if (chest.revealTrigger === TRAP_TYPE.ENEMIES_DEFEATED) {
        chest.reveal();
        // update data manager so we can persist chest state
        const existingChestData =
          DataManager.instance.data.areaDetails[DataManager.instance.data.currentArea.name][this.#currentRoomId]
            ?.chests[chest.id];
        if (!existingChestData || !existingChestData.revealed) {
          DataManager.instance.updateChestData(this.#currentRoomId, chest.id, true, false);
        }
      }
    });
    this.#objectsByRoomId[this.#currentRoomId].doors.forEach((door) => {
      if (door.trapDoorTrigger === TRAP_TYPE.ENEMIES_DEFEATED) {
        door.open();
      }
      if (
        door.trapDoorTrigger === TRAP_TYPE.BOSS_DEFEATED &&
        DataManager.instance.data.areaDetails[DataManager.instance.data.currentArea.name].bossDefeated
      ) {
        door.open();
      }
    });
  }

  #showObjectsInRoomById(roomId: number): void {
    try {
      console.log('[GameScene] Enabling objects in room:', roomId);
      console.log('[GameScene] Room data:', this.#objectsByRoomId[roomId]);
      
      // Add comprehensive null checks before accessing room data
      if (!this.#objectsByRoomId || typeof this.#objectsByRoomId !== 'object') {
        console.warn('[GameScene] objectsByRoomId is not properly initialized');
        return;
      }
      
      if (!this.#objectsByRoomId[roomId]) {
        console.warn('[GameScene] Room data not found for room:', roomId);
        return;
      }
      
      // Check each object type before trying to access it
      if (this.#objectsByRoomId[roomId].doors && Array.isArray(this.#objectsByRoomId[roomId].doors)) {
        console.log('[GameScene] Enabling doors:', this.#objectsByRoomId[roomId].doors.length);
        this.#objectsByRoomId[roomId].doors.forEach((door) => {
          if (door && typeof door.enableObject === 'function') {
            door.enableObject();
          }
        });
      } else {
        console.log('[GameScene] No doors to enable for room:', roomId);
      }
      
      if (this.#objectsByRoomId[roomId].switches && Array.isArray(this.#objectsByRoomId[roomId].switches)) {
        console.log('[GameScene] Enabling switches:', this.#objectsByRoomId[roomId].switches.length);
        this.#objectsByRoomId[roomId].switches.forEach((button) => {
          if (button && typeof button.enableObject === 'function') {
            button.enableObject();
          }
        });
      } else {
        console.log('[GameScene] No switches to enable for room:', roomId);
      }
      
      if (this.#objectsByRoomId[roomId].pots && Array.isArray(this.#objectsByRoomId[roomId].pots)) {
        console.log('[GameScene] Resetting pots:', this.#objectsByRoomId[roomId].pots.length);
        this.#objectsByRoomId[roomId].pots.forEach((pot) => {
          if (pot && typeof pot.resetPosition === 'function') {
            pot.resetPosition();
          }
        });
      } else {
        console.log('[GameScene] No pots to reset for room:', roomId);
      }
      
      if (this.#objectsByRoomId[roomId].chests && Array.isArray(this.#objectsByRoomId[roomId].chests)) {
        console.log('[GameScene] Enabling chests:', this.#objectsByRoomId[roomId].chests.length);
        this.#objectsByRoomId[roomId].chests.forEach((chest) => {
          if (chest && typeof chest.enableObject === 'function') {
            chest.enableObject();
          }
        });
      } else {
        console.log('[GameScene] No chests to enable for room:', roomId);
      }
      
      // Check enemy group separately
      if (this.#objectsByRoomId[roomId].enemyGroup === undefined) {
        console.log('[GameScene] No enemy group found for room:', roomId);
        return;
      }
      
      console.log('[GameScene] Enabling enemies');
      const enemies = this.#objectsByRoomId[roomId].enemyGroup.getChildren();
      if (Array.isArray(enemies)) {
        for (const child of enemies) {
          if (child && typeof (child as CharacterGameObject).enableObject === 'function') {
            (child as CharacterGameObject).enableObject();
          }
        }
      }
      
      console.log('[GameScene] Finished enabling objects in room:', roomId);
    } catch (error) {
      console.error('[GameScene] Error enabling objects in room:', roomId, error);
    }
  }

  #hideObjectsInRoomById(roomId: number): void {
    // Add null checks before accessing room data
    if (!this.#objectsByRoomId || !this.#objectsByRoomId[roomId]) {
      console.warn('[GameScene] Cannot hide objects, room data not found for room:', roomId);
      return;
    }
    
    // Check each object type before trying to access it
    if (this.#objectsByRoomId[roomId].doors && Array.isArray(this.#objectsByRoomId[roomId].doors)) {
      this.#objectsByRoomId[roomId].doors.forEach((door) => {
        if (door && typeof door.disableObject === 'function') {
          door.disableObject();
        }
      });
    }
    
    if (this.#objectsByRoomId[roomId].switches && Array.isArray(this.#objectsByRoomId[roomId].switches)) {
      this.#objectsByRoomId[roomId].switches.forEach((button) => {
        if (button && typeof button.disableObject === 'function') {
          button.disableObject();
        }
      });
    }
    
    if (this.#objectsByRoomId[roomId].pots && Array.isArray(this.#objectsByRoomId[roomId].pots)) {
      this.#objectsByRoomId[roomId].pots.forEach((pot) => {
        if (pot && typeof pot.disableObject === 'function') {
          pot.disableObject();
        }
      });
    }
    
    if (this.#objectsByRoomId[roomId].chests && Array.isArray(this.#objectsByRoomId[roomId].chests)) {
      this.#objectsByRoomId[roomId].chests.forEach((chest) => {
        if (chest && typeof chest.disableObject === 'function') {
          chest.disableObject();
        }
      });
    }
    
    // Check enemy group separately
    if (this.#objectsByRoomId[roomId].enemyGroup !== undefined) {
      const enemies = this.#objectsByRoomId[roomId].enemyGroup.getChildren();
      if (Array.isArray(enemies)) {
        for (const child of enemies) {
          if (child && typeof (child as CharacterGameObject).disableObject === 'function') {
            (child as CharacterGameObject).disableObject();
          }
        }
      }
    }
  }

  #handlePlayerDefeatedEvent(): void {
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SCENE_KEYS.GAME_OVER_SCENE);
    });
    this.cameras.main.fadeOut(1000, 0, 0, 0);
  }

  #handleDialogClosed(): void {
    this.#rewardItem.setVisible(false);
    this.scene.resume();
  }

  #handleBossDefeated(): void {
    DataManager.instance.defeatedCurrentAreaBoss();
    this.#handleAllEnemiesDefeated();
  }
}
