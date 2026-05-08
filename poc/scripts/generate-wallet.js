import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const privateKey = generatePrivateKey()
const account = privateKeyToAccount(privateKey)

console.log('EVM wallet generated')
console.log(`Address:     ${account.address}`)
console.log(`Private key: ${privateKey}`)
console.log('')
console.log('Keep this private key secret. Anyone with it can control the wallet.')
