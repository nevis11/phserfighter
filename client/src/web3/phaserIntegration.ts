import { mintDungeonItem, ItemMetadata } from './mintDungeonItem';

// Loot presets for different chest types
const LOOT_PRESETS: { [key: string]: ItemMetadata } = {
  sword: {
    name: "Flaming Sword",
    description: "A legendary sword that burns enemies",
    uri: "https://example.com/flaming-sword.png",
    attack: 50,
    defense: 10,
    rarity: "Epic",
    itemType: "Sword"
  },
  shield: {
    name: "Old Shield",
    description: "A sturdy shield for protection",
    uri: "https://example.com/old-shield.png",
    attack: 5,
    defense: 30,
    rarity: "Common",
    itemType: "Shield"
  },
  key: {
    name: "Golden Key",
    description: "A key that unlocks mysterious doors",
    uri: "https://example.com/golden-key.png",
    attack: 0,
    defense: 5,
    rarity: "Rare",
    itemType: "Key"
  }
};

// Expose minting function to window object for Phaser to access
export function setupPhaserMinting(signAndSubmitTransaction: any, senderAddress: string) {
  (window as any).mintLootFromGame = async (lootType: string) => {
    try {
      // Check if wallet is connected
      if (!signAndSubmitTransaction || !senderAddress) {
        console.error("No wallet connected");
        return;
      }

      // Map loot type to metadata
      const itemMetadata = LOOT_PRESETS[lootType];
      if (!itemMetadata) {
        console.error("Unknown loot type:", lootType);
        return;
      }

      // Mint the NFT
      const txHash = await mintDungeonItem(
        signAndSubmitTransaction,
        senderAddress,
        itemMetadata
      );

      console.log("Successfully minted loot NFT:", txHash);
      return txHash;
    } catch (error) {
      console.error("Error minting loot:", error);
      throw error;
    }
  };
}

// Clean up function to remove the global reference
export function cleanupPhaserMinting() {
  delete (window as any).mintLootFromGame;
}