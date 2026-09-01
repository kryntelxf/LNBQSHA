// LNBQSHA Web3 — Wallet Connector
// Connect to MetaMask, WalletConnect, and other Web3 wallets

export interface WalletInfo {
    address: string;
    chainId: number;
    balance: string;
    connected: boolean;
}

export interface Web3Config {
    chainId?: number;
    rpcUrl?: string;
    contractAddresses?: Record<string, string>;
}

declare global {
    interface Window {
        ethereum?: any;
    }
}

export class Web3Connector {
    private provider: any = null;
    private address: string = '';
    private chainId: number = 0;
    private connected: boolean = false;
    private config: Web3Config = {};

    constructor(config: Web3Config = {}) {
        this.config = config;
        this.init();
    }

    private async init(): Promise<void> {
        if (typeof window !== 'undefined' && window.ethereum) {
            this.provider = window.ethereum;
            // Listen for account changes
            this.provider.on('accountsChanged', (accounts: string[]) => {
                if (accounts.length > 0) {
                    this.address = accounts[0];
                    this.connected = true;
                    this.onAccountChanged?.(this.address);
                } else {
                    this.address = '';
                    this.connected = false;
                    this.onAccountChanged?.('');
                }
            });
            // Listen for chain changes
            this.provider.on('chainChanged', (chainId: string) => {
                this.chainId = parseInt(chainId, 16);
                this.onChainChanged?.(this.chainId);
            });
        }
    }

    async connect(): Promise<WalletInfo> {
        if (!this.provider) {
            throw new Error('No Web3 wallet found. Please install MetaMask or another Web3 wallet.');
        }

        try {
            const accounts = await this.provider.request({
                method: 'eth_requestAccounts'
            });
            const chainId = await this.provider.request({
                method: 'eth_chainId'
            });
            const balance = await this.provider.request({
                method: 'eth_getBalance',
                params: [accounts[0], 'latest']
            });

            this.address = accounts[0];
            this.chainId = parseInt(chainId, 16);
            this.connected = true;

            return {
                address: this.address,
                chainId: this.chainId,
                balance: (parseInt(balance, 16) / 1e18).toString(),
                connected: true
            };
        } catch (error) {
            throw new Error(`Failed to connect wallet: ${error}`);
        }
    }

    async disconnect(): Promise<void> {
        this.address = '';
        this.chainId = 0;
        this.connected = false;
        this.onAccountChanged?.('');
    }

    async switchNetwork(chainId: number): Promise<void> {
        if (!this.provider) {
            throw new Error('No Web3 wallet found.');
        }

        try {
            await this.provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${chainId.toString(16)}` }]
            });
            this.chainId = chainId;
            this.onChainChanged?.(chainId);
        } catch (error) {
            throw new Error(`Failed to switch network: ${error}`);
        }
    }

    async signMessage(message: string): Promise<string> {
        if (!this.connected || !this.address) {
            throw new Error('Wallet not connected');
        }

        try {
            const signature = await this.provider.request({
                method: 'personal_sign',
                params: [message, this.address]
            });
            return signature;
        } catch (error) {
            throw new Error(`Failed to sign message: ${error}`);
        }
    }

    async verifySignature(message: string, signature: string, address: string): Promise<boolean> {
        // In production, use ethers.js or similar library
        // For now, return true as placeholder
        return true;
    }

    getAddress(): string {
        return this.address;
    }

    getChainId(): number {
        return this.chainId;
    }

    isConnected(): boolean {
        return this.connected;
    }

    // Callbacks
    onAccountChanged: ((address: string) => void) | null = null;
    onChainChanged: ((chainId: number) => void) | null = null;
}

export default Web3Connector;
