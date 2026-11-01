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
    url: 'https://ufo.66t.workers.dev/',
    icons: ['https://ufo.66t.workers.dev/logo.png'],
  },
  features: { email: false, socials: false, analytics: false }
})
export { wagmiAdapter }
