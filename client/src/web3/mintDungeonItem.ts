import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

// Set up the Aptos client
const aptosConfig = new AptosConfig({ network: Network.TESTNET });
export const aptos = new Aptos(aptosConfig);

// Module address - this will be set when you deploy the contract
export const MODULE_ADDRESS = import.meta.env.VITE_MODULE_ADDRESS || "0x1";

export interface ItemMetadata {
  name: string;
  description: string;
  uri: string;
  attack: number;
  defense: number;
  rarity: string;
  itemType: string;
}

export async function mintDungeonItem(
  signAndSubmitTransaction: any,
  senderAddress: string,
  item: ItemMetadata
) {
  try {
    const transaction = {
      sender: senderAddress,
      data: {
        function: `${MODULE_ADDRESS}::dungeon_nft::mint_item`,
        typeArguments: [],
        functionArguments: [
          item.name,
          item.description,
          item.uri,
          item.attack,
          item.defense,
          item.rarity,
          item.itemType
        ],
      },
    };

    const response = await signAndSubmitTransaction(transaction);
    
    // Wait for transaction to be confirmed
    await aptos.waitForTransaction({ transactionHash: response.hash });
    
    return response.hash;
  } catch (error) {
    console.error("Error minting dungeon item:", error);
    throw error;
  }
}