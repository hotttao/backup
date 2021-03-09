import {request} from 'umi'

export type TopologyParam = {
  type:string,
  meter_number: number
}

export async function queryTopology(params?: TopologyParam) {
    return request('/api/topology/topology', {
      params,
    });
}

export async function queryStrategy(params?: any) {
    return request('/api/simulate/strategy', {
      params,
    });
}

export async function queryOutput(params?: any) {
  return request('/api/simulate/output', {
    params,
  });
}