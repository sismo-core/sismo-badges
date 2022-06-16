import { ConfigurableTaskDefinition, HardhatRuntimeEnvironment } from 'hardhat/types';
import { CommonTaskOptions } from './types';
import { DeployOptions } from '../deploy-tasks/utils';

export const addCommonParams = (task: ConfigurableTaskDefinition): ConfigurableTaskDefinition => {
  return task
    .addFlag('log', 'Log deployment steps')
    .addFlag('manualConfirm', 'Manually confirm the deployment');
};

export const getCommonOptions = (options: DeployOptions | CommonTaskOptions): CommonTaskOptions => {
  return {
    manualConfirm: options.manualConfirm,
    log: options.log,
  };
};
