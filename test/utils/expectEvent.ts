export const getEventArgs = (events: any, name: string) => {
  const event = events && events.find((e: any) => e.event === name);
  const args = event && event.args;
  return args;
};
