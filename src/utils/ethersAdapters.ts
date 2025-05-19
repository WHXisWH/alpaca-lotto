import { useWalletClient as useViemWalletClient } from "wagmi";
import { type WalletClient as ViemWalletClient } from "viem";
import { providers, Signer as EthersSigner } from "ethers";
import React from "react";

export function walletClientToSigner(
  walletClient: ViemWalletClient
): EthersSigner {
  const { account, chain, transport } = walletClient;

  if (!chain) {
    throw new Error("Chain not found in wallet client.");
  }
  if (!account) {
    throw new Error("Account not found in wallet client.");
  }

  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new providers.Web3Provider(transport, network);
  const signer = provider.getSigner(account.address);
  return signer;
}

export function useEthersSigner({
  chainId,
}: { chainId?: number } = {}): EthersSigner | undefined {
  const { data: walletClient } = useViemWalletClient({ chainId });

  return React.useMemo(
    () => (walletClient ? walletClientToSigner(walletClient) : undefined),
    [walletClient]
  );
}