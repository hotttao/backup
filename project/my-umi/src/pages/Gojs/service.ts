import {request} from 'umi'

import {TopologyParam} from './data.d'

export async function queryTopology(params?: TopologyParam) {
    return request('/api/topology/topology', {
      params,
    });
}