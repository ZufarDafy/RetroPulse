package handlers

import (
	"net/http"
	"restopulse-backend/models"

	"github.com/gin-gonic/gin"
)

// StaticMenuList contains 6 curated F&B items with complete ID, EN, ZH translations
var StaticMenuList = []models.MenuItem{
	{
		ID: "item-001",
		Price: 38000,
		ImageURL: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&auto=format&fit=crop&q=80",
		Name: map[string]string{
			"id": "Nasi Goreng Spesial RestoPulse",
			"en": "RestoPulse Signature Fried Rice",
			"zh": "脉搏特制印尼炒饭",
		},
		Description: map[string]string{
			"id": "Nasi goreng aroma wok dengan suwiran ayam, udang, telur ceplok mata sapi, dan kerupuk udang renyah.",
			"en": "Wok-tossed fragrant rice with shredded chicken, prawns, sunny-side egg, and crispy prawn crackers.",
			"zh": "经典镬气炒饭配手撕鸡肉、大虾、太阳蛋及香脆虾片。",
		},
		Category: map[string]string{
			"id": "Makanan Utama",
			"en": "Mains",
			"zh": "主食",
		},
		Badge: map[string]string{
			"id": "Favorit Chef",
			"en": "Chef's Pick",
			"zh": "厨师推荐",
		},
	},
	{
		ID: "item-002",
		Price: 42000,
		ImageURL: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&auto=format&fit=crop&q=80",
		Name: map[string]string{
			"id": "Ayam Bakar Madu Pedas",
			"en": "Honey Spicy Grilled Chicken",
			"zh": "蜜汁香辣烤鸡",
		},
		Description: map[string]string{
			"id": "Ayam panggang bumbu rempah nusantara berlumur madu alami dan sambal bajak khas pedas gurih.",
			"en": "Slow-grilled chicken quarter glazed in wild forest honey and zesty traditional sambal.",
			"zh": "炭烤鲜嫩鸡腿排裹以天然野蜂蜜和秘制香辣参巴酱。",
		},
		Category: map[string]string{
			"id": "Makanan Utama",
			"en": "Mains",
			"zh": "主食",
		},
		Badge: map[string]string{
			"id": "Terlaris",
			"en": "Best Seller",
			"zh": "热销",
		},
	},
	{
		ID: "item-003",
		Price: 36000,
		ImageURL: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&auto=format&fit=crop&q=80",
		Name: map[string]string{
			"id": "Mie Goreng Seafood Wok",
			"en": "Wok Seafood Fried Noodles",
			"zh": "镬气海鲜炒面",
		},
		Description: map[string]string{
			"id": "Mie kenyal buatan tangan ditumis dengan cumi segar, bakso ikan, sayuran hijau dan minyak wijen.",
			"en": "Springy artisan noodles flash-stir-fried with fresh calamari, fishballs, and sesame greens.",
			"zh": "弹牙手工面条快炒鲜鱿、鱼丸与翠绿时蔬，芝麻油香扑鼻。",
		},
		Category: map[string]string{
			"id": "Makanan Utama",
			"en": "Mains",
			"zh": "主食",
		},
		Badge: map[string]string{
			"id": "Rekomendasi",
			"en": "Recommended",
			"zh": "推荐",
		},
	},
	{
		ID: "item-004",
		Price: 8000,
		ImageURL: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&auto=format&fit=crop&q=80",
		Name: map[string]string{
			"id": "Es Teh Manis Melati",
			"en": "Sweet Jasmine Iced Tea",
			"zh": "冰甜茉莉花茶",
		},
		Description: map[string]string{
			"id": "Seduhan teh pucuk melati tradisional disajikan dingin dengan gula tebu murni menyegarkan.",
			"en": "Fragrant brewed jasmine tea served chilled with pure sugarcane nectar.",
			"zh": "传统现沏茉莉花茶佐纯甘蔗糖浆，沁人心脾。",
		},
		Category: map[string]string{
			"id": "Minuman",
			"en": "Beverages",
			"zh": "饮品",
		},
		Badge: map[string]string{
			"id": "Segar Dingin",
			"en": "Refreshing",
			"zh": "清爽冰爽",
		},
	},
	{
		ID: "item-005",
		Price: 22000,
		ImageURL: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=600&auto=format&fit=crop&q=80",
		Name: map[string]string{
			"id": "Kopi Susu Gula Aren",
			"en": "Palm Sugar Iced Latte",
			"zh": "椰糖冰拿铁咖啡",
		},
		Description: map[string]string{
			"id": "Double shot espresso biji kopi robusta-arabika lokal berpadu susu segar dan manis legit gula aren organik.",
			"en": "Double espresso shot layered with creamy fresh milk and organic Indonesian palm sugar.",
			"zh": "双份浓缩咖啡调和浓醇鲜奶与有机印尼椰糖蜜。",
		},
		Category: map[string]string{
			"id": "Minuman",
			"en": "Beverages",
			"zh": "饮品",
		},
		Badge: map[string]string{
			"id": "Populer",
			"en": "Popular",
			"zh": "人气",
		},
	},
	{
		ID: "item-006",
		Price: 24000,
		ImageURL: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&auto=format&fit=crop&q=80",
		Name: map[string]string{
			"id": "Pisang Goreng Keju Karamel",
			"en": "Caramel Cheese Crispy Banana",
			"zh": "焦糖芝士脆香蕉",
		},
		Description: map[string]string{
			"id": "Pisang raja manis bersalut tepung renyah keemasan, ditaburi keju cheddar gurih dan drizzle karamel.",
			"en": "Golden crisp plantains topped with savory shredded cheddar cheese and amber caramel drizzle.",
			"zh": "黄金酥脆香蕉条撒以香浓切达芝士碎及琥珀焦糖酱。",
		},
		Category: map[string]string{
			"id": "Camilan & Dessert",
			"en": "Desserts",
			"zh": "甜品小食",
		},
		Badge: map[string]string{
			"id": "Manis Gurih",
			"en": "Sweet & Crispy",
			"zh": "甜脆可口",
		},
	},
}

// GetMenu returns the localized menu catalog
func GetMenu(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   StaticMenuList,
	})
}
