import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { bsc } from '@reown/appkit/networks'

const projectId = 'd6431212399f6c487b364387859983ea'
const wagmiAdapter = new WagmiAdapter({ networks: [bsc], projectId })

export const modal = createAppKit({
  adapters: [wagmiAdapter],
  networks: [bsc],
  projectId,
  metadata: {
    name: 'UFO Fund',
    description: 'High Yield Wealth Management',
    url: 'https://ufo-eea.pages.dev',
    icons: ['https://ufo-eea.pages.dev/logo.png'],
  },
  features: { 
    email: false, 
    socials: false, 
    analytics: false,
    allWallets: true 
  },
  enableMobileWallets: true,
  // 👇 核心修改：强制自定义钱包排序，把 Phantom 顶到第一位！
  featuredWalletIds: [
    'a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393', // Phantom (第一顺位)
    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
    '4622a2b2d6af1c9844944291e5e7351a6aa35e7186ca45a90d0b9b4cf990681e', // Trust Wallet
    'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa'  // Coinbase Wallet
  ]
})
export { wagmiAdapter }
