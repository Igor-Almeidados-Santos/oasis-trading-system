import grpc from 'k6/net/grpc';
import { check, sleep } from 'k6';

const client = new grpc.Client();
const PROTO = '../../api/proto/actions.proto';
const TARGET_ADDR = __ENV.RISK_ENGINE_ADDR || 'localhost:50051';

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || '1m',
};

export function setup() {
  client.load([], PROTO);
  client.connect(TARGET_ADDR, { plaintext: true });
}

export default function () {
  const request = {
    strategy_id: 'virtual-load-test',
    symbol: __ENV.SYMBOL || 'BTC-USD',
    side: 'BUY',
    confidence: 0.42,
    signal_timestamp: {
      seconds: Math.floor(Date.now() / 1000),
      nanos: 0,
    },
  };

  const response = client.invoke(
    'trading.contracts.RiskValidator/ValidateSignal',
    request,
  );

  check(response, {
    'gRPC OK': (r) => r && r.status === grpc.StatusOK,
  });

  sleep(Number(__ENV.SLEEP || 0.5));
}

export function teardown() {
  client.close();
}
