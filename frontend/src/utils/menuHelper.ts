import type { Language, MenuItem } from '../types';

export const DEFAULT_MENU_ITEMS: MenuItem[] = [
  {
    id: 'item-001',
    price: 38000,
    image_url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&auto=format&fit=crop&q=80',
    name: {
      id: 'Nasi Goreng Spesial RestoPulse',
      en: 'RestoPulse Signature Fried Rice',
      zh: '脉搏特制印尼炒饭',
    },
    description: {
      id: 'Nasi goreng aroma wok dengan suwiran ayam, udang, telur ceplok mata sapi, dan kerupuk udang renyah.',
      en: 'Wok-tossed fragrant rice with shredded chicken, prawns, sunny-side egg, and crispy prawn crackers.',
      zh: '经典镬气炒饭配手撕鸡肉、大虾、太阳蛋及香脆虾片。',
    },
    category: {
      id: 'Makanan Utama',
      en: 'Mains',
      zh: '主食',
    },
    badge: {
      id: 'Favorit Chef',
      en: "Chef's Pick",
      zh: '厨师推荐',
    },
  },
  {
    id: 'item-002',
    price: 42000,
    image_url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&auto=format&fit=crop&q=80',
    name: {
      id: 'Ayam Bakar Madu Pedas',
      en: 'Honey Spicy Grilled Chicken',
      zh: '蜜汁香辣烤鸡',
    },
    description: {
      id: 'Ayam panggang bumbu rempah nusantara berlumur madu alami dan sambal bajak khas pedas gurih.',
      en: 'Slow-grilled chicken quarter glazed in wild forest honey and zesty traditional sambal.',
      zh: '炭烤鲜嫩鸡腿排裹以天然野蜂蜜和秘制香辣参巴酱。',
    },
    category: {
      id: 'Makanan Utama',
      en: 'Mains',
      zh: '主食',
    },
    badge: {
      id: 'Terlaris',
      en: 'Best Seller',
      zh: '热销',
    },
  },
  {
    id: 'item-003',
    price: 36000,
    image_url: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&auto=format&fit=crop&q=80',
    name: {
      id: 'Mie Goreng Seafood Wok',
      en: 'Wok Seafood Fried Noodles',
      zh: '镬气海鲜炒面',
    },
    description: {
      id: 'Mie kenyal buatan tangan ditumis dengan cumi segar, bakso ikan, sayuran hijau dan minyak wijen.',
      en: 'Springy artisan noodles flash-stir-fried with fresh calamari, fishballs, and sesame greens.',
      zh: '弹牙手工面条快炒鲜鱿、鱼丸与翠绿时蔬，芝麻油香扑鼻。',
    },
    category: {
      id: 'Makanan Utama',
      en: 'Mains',
      zh: '主食',
    },
    badge: {
      id: 'Rekomendasi',
      en: 'Recommended',
      zh: '推荐',
    },
  },
  {
    id: 'item-004',
    price: 8000,
    image_url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=80',
    name: {
      id: 'Es Teh Manis Melati',
      en: 'Sweet Jasmine Iced Tea',
      zh: '冰甜茉莉花茶',
    },
    description: {
      id: 'Seduhan teh pucuk melati tradisional disajikan dingin dengan gula tebu murni menyegarkan.',
      en: 'Fragrant brewed jasmine tea served chilled with pure sugarcane nectar.',
      zh: '传统现沏茉莉花茶佐纯甘蔗糖浆，沁人心脾。',
    },
    category: {
      id: 'Minuman',
      en: 'Beverages',
      zh: '饮品',
    },
    badge: {
      id: 'Segar Dingin',
      en: 'Refreshing',
      zh: '清爽冰爽',
    },
  },
  {
    id: 'item-005',
    price: 22000,
    image_url: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&auto=format&fit=crop&q=80',
    name: {
      id: 'Kopi Susu Gula Aren',
      en: 'Palm Sugar Iced Latte',
      zh: '椰糖冰拿铁咖啡',
    },
    description: {
      id: 'Double shot espresso biji kopi robusta-arabika lokal berpadu susu segar dan manis legit gula aren organik.',
      en: 'Double espresso shot layered with creamy fresh milk and organic Indonesian palm sugar.',
      zh: '双份浓缩咖啡调和浓醇鲜奶与有机印尼椰糖蜜。',
    },
    category: {
      id: 'Minuman',
      en: 'Beverages',
      zh: '饮品',
    },
    badge: {
      id: 'Populer',
      en: 'Popular',
      zh: '人气',
    },
  },
  {
    id: 'item-006',
    price: 24000,
    image_url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80',
    name: {
      id: 'Pisang Goreng Keju Karamel',
      en: 'Caramel Cheese Crispy Banana',
      zh: '焦糖芝士脆香蕉',
    },
    description: {
      id: 'Pisang raja manis bersalut tepung renyah keemasan, ditaburi keju cheddar gurih dan drizzle karamel.',
      en: 'Golden crisp plantains topped with savory shredded cheddar cheese and amber caramel drizzle.',
      zh: '黄金酥脆香蕉条撒以香浓切达芝士碎及琥珀焦糖酱。',
    },
    category: {
      id: 'Camilan & Dessert',
      en: 'Desserts',
      zh: '甜品小食',
    },
    badge: {
      id: 'Manis Gurih',
      en: 'Sweet & Crispy',
      zh: '甜脆可口',
    },
  },
];

export function getLocalizedItemName(
  menuItemId?: string,
  fallbackName?: string,
  dynamicMenuItems?: MenuItem[],
  language: Language = 'en'
): string {
  const allItems =
    dynamicMenuItems && dynamicMenuItems.length > 0
      ? dynamicMenuItems
      : DEFAULT_MENU_ITEMS;

  // 1. By menuItemId
  if (menuItemId) {
    const found = allItems.find((m) => m.id === menuItemId);
    if (found && found.name && found.name[language]) {
      return found.name[language];
    }
  }

  // 2. By matching name across any language
  if (fallbackName) {
    const foundByName = allItems.find(
      (m) =>
        m.name.id === fallbackName ||
        m.name.en === fallbackName ||
        m.name.zh === fallbackName
    );
    if (foundByName && foundByName.name && foundByName.name[language]) {
      return foundByName.name[language];
    }
  }

  return fallbackName || '';
}

