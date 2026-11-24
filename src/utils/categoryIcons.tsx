import React from 'react';
import {
  LayoutGrid,
  Coffee,
  Package,
  Soup,
  Cookie,
  Droplets,
  Smartphone,
  Wheat,
  Egg,
  Apple,
  Pill,
  Flame,
  Tag,
  Boxes,
  LucideProps,
} from 'lucide-react';

export const DEFAULT_CATEGORIES: string[] = [
  'Beverages',
  'Canned Goods',
  'Instant Noodles',
  'Snacks',
  'Toiletries/Sachets',
  'Other',
];

export interface CategorySuggestion {
  name: string;
  label: string;
}

export const POPULAR_CATEGORY_SUGGESTIONS: CategorySuggestion[] = [
  { name: 'Frozen Goods & Ice', label: 'Frozen Goods' },
  { name: 'Rice & Grains', label: 'Rice & Grains' },
  { name: 'Bakery & Bread', label: 'Bakery' },
  { name: 'Fresh Eggs', label: 'Eggs' },
  { name: 'Fresh Produce', label: 'Produce' },
  { name: 'Tobacco & Matches', label: 'Tobacco' },
  { name: 'Medicine & First Aid', label: 'Medicine' },
  { name: 'School Supplies', label: 'School Supplies' },
  { name: 'Condiments & Spices', label: 'Condiments' },
];

export interface CategoryIconProps extends LucideProps {
  category: string;
}

/**
 * Professional vector-based category icon component using Lucide icons.
 * Strictly avoids non-standard raw emojis for UI structure.
 */
export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  className = 'w-4 h-4',
  ...props
}) => {
  const lower = (category || '').toLowerCase();

  if (lower === 'all' || lower === 'all items') {
    return <LayoutGrid className={className} aria-hidden="true" {...props} />;
  }
  if (
    lower.includes('drink') ||
    lower.includes('water') ||
    lower.includes('juice') ||
    lower.includes('beer') ||
    lower.includes('liquor') ||
    lower.includes('beverage') ||
    lower.includes('coffee') ||
    lower.includes('tea')
  ) {
    return <Coffee className={className} aria-hidden="true" {...props} />;
  }
  if (
    lower.includes('can') ||
    lower.includes('sardine') ||
    lower.includes('tuna') ||
    lower.includes('meat') ||
    lower.includes('corned')
  ) {
    return <Package className={className} aria-hidden="true" {...props} />;
  }
  if (
    lower.includes('noodle') ||
    lower.includes('pancit') ||
    lower.includes('soup') ||
    lower.includes('ramen') ||
    lower.includes('canton')
  ) {
    return <Soup className={className} aria-hidden="true" {...props} />;
  }
  if (
    lower.includes('snack') ||
    lower.includes('chip') ||
    lower.includes('biscuit') ||
    lower.includes('candy') ||
    lower.includes('chichirya') ||
    lower.includes('cookie') ||
    lower.includes('sweet')
  ) {
    return <Cookie className={className} aria-hidden="true" {...props} />;
  }
  if (
    lower.includes('soap') ||
    lower.includes('shampoo') ||
    lower.includes('detergent') ||
    lower.includes('hygiene') ||
    lower.includes('toiletr') ||
    lower.includes('sachet') ||
    lower.includes('lotion')
  ) {
    return <Droplets className={className} aria-hidden="true" {...props} />;
  }
  if (
    lower.includes('load') ||
    lower.includes('gcash') ||
    lower.includes('maya') ||
    lower.includes('phone')
  ) {
    return <Smartphone className={className} aria-hidden="true" {...props} />;
  }
  if (lower.includes('rice') || lower.includes('bigas') || lower.includes('grain')) {
    return <Wheat className={className} aria-hidden="true" {...props} />;
  }
  if (lower.includes('egg') || lower.includes('itlog')) {
    return <Egg className={className} aria-hidden="true" {...props} />;
  }
  if (
    lower.includes('veg') ||
    lower.includes('fruit') ||
    lower.includes('gulay') ||
    lower.includes('fresh') ||
    lower.includes('produce')
  ) {
    return <Apple className={className} aria-hidden="true" {...props} />;
  }
  if (
    lower.includes('med') ||
    lower.includes('gamot') ||
    lower.includes('pill') ||
    lower.includes('health') ||
    lower.includes('first aid')
  ) {
    return <Pill className={className} aria-hidden="true" {...props} />;
  }
  if (
    lower.includes('sigarilyo') ||
    lower.includes('smoke') ||
    lower.includes('tobacco') ||
    lower.includes('cigar') ||
    lower.includes('lighter') ||
    lower.includes('match')
  ) {
    return <Flame className={className} aria-hidden="true" {...props} />;
  }
  if (lower.includes('box') || lower.includes('case') || lower.includes('pack')) {
    return <Boxes className={className} aria-hidden="true" {...props} />;
  }

  return <Tag className={className} aria-hidden="true" {...props} />;
};

/**
 * Backward compatibility helper for text-only contexts
 */
export function getCategoryIcon(category: string): string {
  return '';
}
