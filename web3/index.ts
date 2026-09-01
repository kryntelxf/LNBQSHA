// LNBQSHA Web3 — Main Entry Point
// Export all Web3 modules

export { default as Web3Connector } from './wallet';
export { default as OnChainAchievements } from './achievements';

// Utility functions
export function formatAddress(address: string): string {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

export function formatBalance(balance: string): string {
    const num = parseFloat(balance);
    if (isNaN(num)) return '0';
    if (num >= 1) return num.toFixed(2);
    if (num >= 0.001) return (num * 1000).toFixed(2) + ' m';
    return '< 0.001';
}

export const SUPPORTED_CHAINS = {
    ETHEREUM: 1,
    POLYGON: 137,
    ARBITRUM: 42161,
    OPTIMISM: 10,
    BASE: 8453,
    SEPOLIA: 11155111
};

export const CHAIN_NAMES: Record<number, string> = {
    [SUPPORTED_CHAINS.ETHEREUM]: 'Ethereum',
    [SUPPORTED_CHAINS.POLYGON]: 'Polygon',
    [SUPPORTED_CHAINS.ARBITRUM]: 'Arbitrum',
    [SUPPORTED_CHAINS.OPTIMISM]: 'Optimism',
    [SUPPORTED_CHAINS.BASE]: 'Base',
    [SUPPORTED_CHAINS.SEPOLIA]: 'Sepolia'
};

export const CHAIN_EXPLORERS: Record<number, string> = {
    [SUPPORTED_CHAINS.ETHEREUM]: 'https://etherscan.io',
    [SUPPORTED_CHAINS.POLYGON]: 'https://polygonscan.com',
    [SUPPORTED_CHAINS.ARBITRUM]: 'https://arbiscan.io',
    [SUPPORTED_CHAINS.OPTIMISM]: 'https://optimistic.etherscan.io',
    [SUPPORTED_CHAINS.BASE]: 'https://basescan.org',
    [SUPPORTED_CHAINS.SEPOLIA]: 'https://sepolia.etherscan.io'
};

// NFT contract ABI (simplified)
export const NFT_ABI = [
    'function mint(address to, string memory uri) external returns (uint256)',
    'function transferFrom(address from, address to, uint256 tokenId) external',
    'function ownerOf(uint256 tokenId) external view returns (address)',
    'function tokenURI(uint256 tokenId) external view returns (string)',
    'function balanceOf(address owner) external view returns (uint256)',
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
    'event Mint(address indexed to, uint256 indexed tokenId, string uri)'
];

// Achievement NFT contract address (placeholder)
export const ACHIEVEMENT_NFT_CONTRACT = '0x0000000000000000000000000000000000000000';
