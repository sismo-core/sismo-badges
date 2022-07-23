import { DefenderRelayProvider, DefenderRelaySigner } from 'defender-relay-client/lib/ethers';
import { Signer } from 'ethers';

const { RELAYER_API_KEY, RELAYER_API_SECRET } = process.env;

export const getRelayerSigner = async (): Promise<Signer> => {
  if (!RELAYER_API_KEY || !RELAYER_API_SECRET) {
    throw new Error('RELAYER_API_KEY or RELAYER_API_SECRET env variables missing');
  }
  const credentials = { apiKey: RELAYER_API_KEY, apiSecret: RELAYER_API_SECRET };
  const provider = new DefenderRelayProvider(credentials);
  return new DefenderRelaySigner(credentials, provider, { speed: 'fast' });
};
