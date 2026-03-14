import { useState, useEffect, useCallback } from 'react'
import { BrowserProvider, Contract, formatEther, parseEther, getAddress, isAddress } from 'ethers'
import GreenGoldAbi from './abi/GreenGold.json'
import './App.css'

const ABI = GreenGoldAbi as never

const CONTRACT_ADDRESS_KEY = 'greengold_contract_address'
const defaultAddress = import.meta.env.VITE_CONTRACT_ADDRESS || ''

function App() {
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<bigint | null>(null)
  const [contractAddress, setContractAddress] = useState(() =>
    localStorage.getItem(CONTRACT_ADDRESS_KEY) || defaultAddress
  )
  const [balance, setBalance] = useState<string>('0')
  const [tokenPrice, setTokenPrice] = useState<string>('0')
  const [txStatus, setTxStatus] = useState<string>('')

  // Buy form
  const [buyEth, setBuyEth] = useState('')
  // Claim form
  const [claimAmount, setClaimAmount] = useState('')
  const [claimNonce, setClaimNonce] = useState('')
  const [claimType, setClaimType] = useState('0')
  const [claimSignature, setClaimSignature] = useState('')
  // Transfer form
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  // Burn form
  const [burnAmount, setBurnAmount] = useState('')

  const contractAddressValid = contractAddress.trim() !== '' && isAddress(contractAddress.trim())

  const getContract = useCallback(async (): Promise<Contract | null> => {
    if (!provider || !account || !contractAddressValid) return null
    const signer = await provider.getSigner()
    return new Contract(getAddress(contractAddress.trim()), ABI, signer)
  }, [provider, account, contractAddressValid, contractAddress])

  const refreshBalances = useCallback(async () => {
    if (!provider || !account || !contractAddressValid) return
    const address = getAddress(contractAddress.trim())
    const contract = new Contract(address, ABI, provider)
    try {
      const [bal, price] = await Promise.all([
        contract.balanceOf(account),
        contract.tokenPriceWei(),
      ])
      setBalance(formatEther(bal))
      setTokenPrice(formatEther(price))
      setTxStatus((s) => (s && s.startsWith('Failed to load') ? '' : s))
    } catch (e) {
      console.error(e)
      setBalance('0')
      setTokenPrice('0')
      const msg = e instanceof Error ? e.message : 'Failed to load balance'
      setTxStatus(`Failed to load balance. (Wrong network or invalid contract? ${msg})`)
    }
  }, [provider, account, contractAddressValid, contractAddress])

  useEffect(() => {
    if (contractAddress) localStorage.setItem(CONTRACT_ADDRESS_KEY, contractAddress)
  }, [contractAddress])

  useEffect(() => {
    if (!provider || !account) return
    refreshBalances()
    const interval = setInterval(refreshBalances, 10000)
    return () => clearInterval(interval)
  }, [provider, account, contractAddress, refreshBalances])

  const connect = async () => {
    setTxStatus('')
    const eth = (window as unknown as { ethereum?: { request: (a: unknown) => Promise<unknown> } }).ethereum
    if (!eth) {
      setTxStatus('MetaMask (or another wallet) not found. Install it and refresh.')
      return
    }
    try {
      const prov = new BrowserProvider(eth)
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
      const network = await prov.getNetwork()
      setProvider(prov)
      setAccount(accounts[0] || null)
      setChainId(network.chainId)
    } catch (e) {
      setTxStatus((e as Error).message || 'Connection failed')
    }
  }

  const disconnect = () => {
    setProvider(null)
    setAccount(null)
    setChainId(null)
    setBalance('0')
    setTokenPrice('0')
    setTxStatus('')
  }

  const saveContractAddress = () => {
    const addr = contractAddress.trim()
    if (addr) {
      setContractAddress(addr)
      setTxStatus('Contract address saved. Refresh balances if connected.')
    }
  }

  const handleBuy = async () => {
    const contract = await getContract()
    if (!contract || !buyEth) {
      setTxStatus('Enter ETH amount and ensure wallet + contract are set.')
      return
    }
    setTxStatus('Confirm in your wallet...')
    try {
      const value = parseEther(buyEth)
      const tx = await contract.buyWithEth({ value })
      setTxStatus('Transaction sent. Waiting for confirmation...')
      await tx.wait()
      setTxStatus('Purchase successful.')
      setBuyEth('')
      refreshBalances()
    } catch (e) {
      setTxStatus((e as Error).message || 'Buy failed')
    }
  }

  const handleClaim = async () => {
    const contract = await getContract()
    if (!contract || !claimAmount || !claimNonce || !claimSignature.trim()) {
      setTxStatus('Fill amount, nonce, and signature. Get signature from scripts/signClaim.js.')
      return
    }
    setTxStatus('Confirm in your wallet...')
    try {
      const amount = parseEther(claimAmount)
      const nonce = BigInt(claimNonce)
      const sig = claimSignature.trim().startsWith('0x') ? claimSignature.trim() : `0x${claimSignature.trim()}`
      const tx = await contract.claimWithSustainabilityData(amount, nonce, parseInt(claimType, 10), sig)
      setTxStatus('Transaction sent. Waiting...')
      await tx.wait()
      setTxStatus('Claim successful.')
      setClaimAmount('')
      setClaimNonce('')
      setClaimSignature('')
      refreshBalances()
    } catch (e) {
      setTxStatus((e as Error).message || 'Claim failed')
    }
  }

  const handleTransfer = async () => {
    const contract = await getContract()
    if (!contract || !transferTo.trim() || !transferAmount) {
      setTxStatus('Enter recipient address and amount.')
      return
    }
    setTxStatus('Confirm in your wallet...')
    try {
      const tx = await contract.transfer(transferTo.trim(), parseEther(transferAmount))
      await tx.wait()
      setTxStatus('Transfer successful.')
      setTransferTo('')
      setTransferAmount('')
      refreshBalances()
    } catch (e) {
      setTxStatus((e as Error).message || 'Transfer failed')
    }
  }

  const handleBurn = async () => {
    const contract = await getContract()
    if (!contract || !burnAmount) {
      setTxStatus('Enter amount to burn.')
      return
    }
    setTxStatus('Confirm in your wallet...')
    try {
      const tx = await contract.burn(parseEther(burnAmount))
      await tx.wait()
      setTxStatus('Burn successful.')
      setBurnAmount('')
      refreshBalances()
    } catch (e) {
      setTxStatus((e as Error).message || 'Burn failed')
    }
  }

  return (
    <div className="app">
      <header className="header animate-in">
        <div className="header-logo">
          <img src="/logo.svg" alt="" />
        </div>
        <h1>GreenGold</h1>
        <p className="subtitle">Buy with ETH or claim with sustainability data · GGC</p>
      </header>

      <section className="section contract-section animate-in animate-in-1">
        <h2>Contract</h2>
        <div className="row">
          <input
            type="text"
            placeholder="GreenGold contract address (0x...)"
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            className="input address-input"
          />
          <button type="button" onClick={saveContractAddress} className="btn btn-secondary">
            Save
          </button>
        </div>
        {contractAddress.trim() && !contractAddressValid && (
          <p className="error-msg">Not a valid Ethereum address.</p>
        )}
      </section>

      <section className="section wallet-section animate-in animate-in-2">
        <h2>Wallet</h2>
        {!account ? (
          <button type="button" onClick={connect} className="btn btn-primary">
            Connect wallet
          </button>
        ) : (
          <div className="wallet-info">
            <span className="address">{account.slice(0, 6)}…{account.slice(-4)}</span>
            <span className="chain">Chain ID: {chainId?.toString() ?? '—'}</span>
            <button type="button" onClick={disconnect} className="btn btn-outline">
              Disconnect
            </button>
          </div>
        )}
      </section>

      {account && (
        <>
          {!contractAddressValid && (
            <div className="status warning animate-in">Save a valid GreenGold contract address above to use balances and actions.</div>
          )}
          <section className="section balances-section animate-in animate-in-3">
            <h2>Balances</h2>
            <div className="balances">
              <div className="balance-card">
                <span className="label">Your GGC</span>
                <span className="value">{balance} GGC</span>
              </div>
              <div className="balance-card">
                <span className="label">Token price</span>
                <span className="value gold">{tokenPrice} ETH</span>
              </div>
            </div>
            <button type="button" onClick={refreshBalances} className="btn btn-outline btn-sm" disabled={!contractAddressValid}>
              Refresh
            </button>
          </section>

          <section className="section action-section animate-in animate-in-4">
            <h2>Buy with ETH</h2>
            <div className="form row">
              <input
                type="text"
                placeholder="ETH amount"
                value={buyEth}
                onChange={(e) => setBuyEth(e.target.value)}
                className="input"
              />
              <button type="button" onClick={handleBuy} className="btn btn-primary" disabled={!contractAddressValid}>
                Buy GGC
              </button>
            </div>
          </section>

          <section className="section action-section animate-in animate-in-5">
            <h2>Claim (sustainability)</h2>
            <p className="hint">Get a signature from <code>node scripts/signClaim.js</code> (verifier key required).</p>
            <div className="form stack">
              <div className="row">
                <input
                  type="text"
                  placeholder="Token amount (e.g. 100)"
                  value={claimAmount}
                  onChange={(e) => setClaimAmount(e.target.value)}
                  className="input"
                />
                <input
                  type="text"
                  placeholder="Nonce"
                  value={claimNonce}
                  onChange={(e) => setClaimNonce(e.target.value)}
                  className="input"
                />
                <select value={claimType} onChange={(e) => setClaimType(e.target.value)} className="input">
                  <option value="0">Type 0 (e.g. renewable)</option>
                  <option value="1">Type 1 (e.g. emissions)</option>
                </select>
              </div>
              <input
                type="text"
                placeholder="Signature (0x...)"
                value={claimSignature}
                onChange={(e) => setClaimSignature(e.target.value)}
                className="input full"
              />
              <button type="button" onClick={handleClaim} className="btn btn-primary" disabled={!contractAddressValid}>
                Claim GGC
              </button>
            </div>
          </section>

          <section className="section action-section animate-in animate-in-6">
            <h2>Transfer</h2>
            <div className="form row">
              <input
                type="text"
                placeholder="Recipient address"
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                className="input address-input"
              />
              <input
                type="text"
                placeholder="GGC amount"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="input"
              />
              <button type="button" onClick={handleTransfer} className="btn btn-primary" disabled={!contractAddressValid}>
                Transfer
              </button>
            </div>
          </section>

          <section className="section action-section animate-in animate-in-7">
            <h2>Burn</h2>
            <div className="form row">
              <input
                type="text"
                placeholder="GGC amount to burn"
                value={burnAmount}
                onChange={(e) => setBurnAmount(e.target.value)}
                className="input"
              />
              <button type="button" onClick={handleBurn} className="btn btn-danger" disabled={!contractAddressValid}>
                Burn
              </button>
            </div>
          </section>
        </>
      )}

      {txStatus && (
        <div className="status" role="status">
          {txStatus}
        </div>
      )}
    </div>
  )
}

export default App
