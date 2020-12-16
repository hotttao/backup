import {
    AppstoreOutlined,
    MenuUnfoldOutlined,
    MenuFoldOutlined,
    PieChartOutlined,
    DesktopOutlined,
    ContainerOutlined,
    MailOutlined,
    AreaChartOutlined
  } from '@ant-design/icons';

const menuList = [
    {
      title: '首页', // 菜单标题名称
      key: '/home', // 对应的path
      icon: <AppstoreOutlined></AppstoreOutlined>, // 图标名称
      public: true, // 公开的
    },
    {
      title: '商品',
      key: '/products',
      icon: <MenuUnfoldOutlined></MenuUnfoldOutlined>,
      children: [ // 子菜单列表
        {
          title: '品类管理',
          key: '/category',
          icon: <MenuFoldOutlined></MenuFoldOutlined>
        },
        {
          title: '商品管理',
          key: '/product',
          icon: <PieChartOutlined></PieChartOutlined>
        },
      ]
    },
  
    {
      title: '用户管理',
      key: '/user',
      icon: <DesktopOutlined />
    },
    {
      title: '角色管理',
      key: '/role',
      icon: <ContainerOutlined />,
    },
  
    {
      title: '图形图表',
      key: '/charts',
      icon: 'area-chart',
      children: [
        {
          title: '柱形图',
          key: '/charts/bar',
          icon: <MailOutlined />
        },
        {
          title: '折线图',
          key: '/charts/line',
          icon: <AreaChartOutlined />
        },
        {
          title: '饼图',
          key: '/charts/pie',
          icon: <PieChartOutlined />
        },
      ]
    },
  ]
  
  export default menuList