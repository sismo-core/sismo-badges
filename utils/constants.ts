import { ethers, BytesLike } from 'ethers';
import { toUtf8Bytes } from 'ethers/lib/utils';

export const EVENT_TRIGGERER_ROLE: BytesLike = ethers.utils.keccak256(
  toUtf8Bytes('EVENT_TRIGGERER_ROLE')
);
