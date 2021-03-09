export default [
  {
    path: '/user',
    layout: false,
    routes: [
      {
        path: '/user',
        routes: [
          {
            name: 'login',
            path: '/user/login',
            component: './User/login',
          },
        ],
      },
    ],
  },
  {
    path: '/topology',
    name: 'topology',
    icon: 'smile',
    component: './Topology/index',
  },
  {
    path: '/simulation',
    name: 'simulation',
    icon: 'crown',
    access: 'canAdmin',
    component: './Simulation/index',
    routes: [
      {
        path: '/simulation/new',
        name: 'new',
        icon: 'smile',
        component: './Simulation/new',
      },
      {
        path: '/simulation/task',
        name: 'task',
        icon: 'smile',
        component: './Simulation/task',
      },
    ],
  },
  {
    path: '/admin',
    name: 'admin',
    icon: 'crown',
    access: 'canAdmin',
    component: './Admin',
    routes: [
      {
        path: '/admin/demand',
        name: 'demand',
        icon: 'smile',
        component: './Welcome',
      },
    ],
  },
  {
    name: 'visualization',
    icon: 'table',
    path: '/visualization',
    component: './TableList',
  },
  {
    path: '/',
    redirect: '/topology',
  },
  {
    component: './404',
  },
];
