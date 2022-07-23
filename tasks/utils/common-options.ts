import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { CommonTaskOptions } from './types';
import { DeployOptions } from '../deploy-tasks/utils';
import { deploymentsConfig } from '../deploy-tasks/deployments-config';

export const getCommonOptions = (options: DeployOptions | CommonTaskOptions): CommonTaskOptions => {
  return {
    manualConfirm: options.manualConfirm,
    log: options.log,
  };
};

export const wrapCommonOptions = (action: Function) => {
  return (args: any, hre: HardhatRuntimeEnvironment) => {
    const config = deploymentsConfig[hre.network.name];
    return action(
      {
        ...args,
        options: {
          ...getCommonOptions(config.deployOptions),
          ...args.options,
        },
      },
      hre
    );
  };
};
