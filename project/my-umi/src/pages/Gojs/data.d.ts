import { List } from "lodash"

export type TopologyParam = {
  type:string,
  meter_number: number
}

export type MeterLink = {
  from: number,
  to: number
}

export type MeterInfo = {
  node_id: number,
  type: number,
  line_length: number
}


export type Meter = {
  link: MeterLink[],
  info: MeterInfo[]
}

export type Topology = {
  message?: string,
  success: boolean,
  data: Meter
}


