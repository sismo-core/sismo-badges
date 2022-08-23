#!/bin/sh
set -e

HOSTNAME=${LOCAL_HOSTNAME:-'localhost'} 
PORT=${LOCAL_PORT:-8545}
while ! nc -z $HOSTNAME $PORT; do   
  echo "Waiting for chain to be up ..."
  sleep 2 
done
 
>&2 echo "Chain is up - executing command"
exec "$@"
