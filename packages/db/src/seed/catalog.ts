import { ProductCategory } from '@scp/shared';

interface ProductSeed {
  name: string;
  category: ProductCategory;
  price: number;
}

/** Curated NovaWear catalog so generated orders/messages feel like a real brand. */
export const PRODUCT_CATALOG: ProductSeed[] = [
  // Fashion
  { name: 'Linen Summer Dress', category: ProductCategory.FASHION, price: 2499 },
  { name: 'Floral Maxi Dress', category: ProductCategory.FASHION, price: 3299 },
  { name: 'Oversized Cotton Shirt', category: ProductCategory.FASHION, price: 1799 },
  { name: 'High-Rise Denim Jeans', category: ProductCategory.FASHION, price: 2899 },
  { name: 'Pleated Midi Skirt', category: ProductCategory.FASHION, price: 1999 },
  { name: 'Tailored Blazer', category: ProductCategory.FASHION, price: 4499 },
  { name: 'Ribbed Knit Sweater', category: ProductCategory.FASHION, price: 2199 },
  { name: 'Wide-Leg Trousers', category: ProductCategory.FASHION, price: 2599 },
  { name: 'Cropped Cardigan', category: ProductCategory.FASHION, price: 1899 },
  { name: 'Satin Slip Dress', category: ProductCategory.FASHION, price: 2799 },
  { name: 'Cotton Co-ord Set', category: ProductCategory.FASHION, price: 3499 },
  { name: 'Graphic Oversized Tee', category: ProductCategory.FASHION, price: 999 },
  // Beauty
  { name: 'Vitamin C Serum', category: ProductCategory.BEAUTY, price: 1299 },
  { name: 'Hydrating Face Mist', category: ProductCategory.BEAUTY, price: 799 },
  { name: 'Matte Liquid Lipstick', category: ProductCategory.BEAUTY, price: 699 },
  { name: 'Niacinamide Moisturiser', category: ProductCategory.BEAUTY, price: 1099 },
  { name: 'SPF 50 Sunscreen', category: ProductCategory.BEAUTY, price: 899 },
  { name: 'Volumising Mascara', category: ProductCategory.BEAUTY, price: 749 },
  { name: 'Rose Glow Highlighter', category: ProductCategory.BEAUTY, price: 999 },
  { name: 'Retinol Night Cream', category: ProductCategory.BEAUTY, price: 1799 },
  { name: 'Gentle Foaming Cleanser', category: ProductCategory.BEAUTY, price: 649 },
  { name: 'Tinted Lip Balm Trio', category: ProductCategory.BEAUTY, price: 899 },
  { name: 'Argan Hair Oil', category: ProductCategory.BEAUTY, price: 1199 },
  { name: 'Eyeshadow Palette', category: ProductCategory.BEAUTY, price: 1599 },
  // Accessories
  { name: 'Structured Tote Bag', category: ProductCategory.ACCESSORIES, price: 3999 },
  { name: 'Gold Hoop Earrings', category: ProductCategory.ACCESSORIES, price: 1299 },
  { name: 'Leather Crossbody Bag', category: ProductCategory.ACCESSORIES, price: 4599 },
  { name: 'Oversized Sunglasses', category: ProductCategory.ACCESSORIES, price: 1899 },
  { name: 'Minimalist Watch', category: ProductCategory.ACCESSORIES, price: 5499 },
  { name: 'Silk Scarf', category: ProductCategory.ACCESSORIES, price: 1499 },
  { name: 'Layered Necklace Set', category: ProductCategory.ACCESSORIES, price: 1099 },
  { name: 'Woven Belt', category: ProductCategory.ACCESSORIES, price: 999 },
  { name: 'Canvas Bucket Hat', category: ProductCategory.ACCESSORIES, price: 899 },
  { name: 'Beaded Bracelet Stack', category: ProductCategory.ACCESSORIES, price: 749 },
  { name: 'Quilted Wallet', category: ProductCategory.ACCESSORIES, price: 1999 },
  { name: 'Statement Ring', category: ProductCategory.ACCESSORIES, price: 899 },
  // Sneakers
  { name: 'Retro Court Sneakers', category: ProductCategory.SNEAKERS, price: 4999 },
  { name: 'Chunky Trail Sneakers', category: ProductCategory.SNEAKERS, price: 5999 },
  { name: 'Minimal White Sneakers', category: ProductCategory.SNEAKERS, price: 4499 },
  { name: 'High-Top Canvas Kicks', category: ProductCategory.SNEAKERS, price: 3499 },
  { name: 'Running Performance Shoes', category: ProductCategory.SNEAKERS, price: 6499 },
  { name: 'Slip-On Knit Sneakers', category: ProductCategory.SNEAKERS, price: 3999 },
  { name: 'Platform Sneakers', category: ProductCategory.SNEAKERS, price: 4799 },
  { name: 'Limited Edition Drop Sneakers', category: ProductCategory.SNEAKERS, price: 7999 },
];
