import readline from 'readline';

export function confirm(): Promise<void> {
  return new Promise((resolve) => {
    const myReadLine = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    myReadLine.question('Do you want to continue? Y/n \n', (input) => {
      myReadLine.close();
      if (input === 'Y' || input == 'y') {
        console.log('\n');
        resolve(undefined);
      } else {
        console.log('Deployment aborted');
        process.exit(0);
      }
    });
  });
}
