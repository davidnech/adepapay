// Suggestions are saved as store categories when assigned to a product.
export const productCategoryGroups: Record<string, readonly string[]> = {
  "Electronics & technology": ["Phones", "Phone Accessories", "Tablets", "Tablet Accessories", "Laptops", "Desktop Computers", "Computer Components", "Computer Accessories", "Monitors", "Printers & Scanners", "Networking Equipment", "Computer Storage", "Software", "Televisions", "TV Accessories", "Speakers", "Headphones & Earbuds", "Audio Equipment", "Cameras", "Camera Accessories", "Video Equipment", "Drones", "Gaming Consoles", "Video Games", "Gaming Accessories", "Smart Watches", "Wearable Technology", "Smart Home Devices", "Electronic Components"],
  "Home appliances": ["Refrigerators", "Freezers", "Washing Machines", "Dryers", "Dishwashers", "Cookers & Ovens", "Microwaves", "Blenders & Food Processors", "Kettles", "Coffee Machines", "Toasters", "Air Fryers", "Rice Cookers", "Kitchen Appliances", "Air Conditioners", "Fans", "Heaters", "Irons & Steamers", "Vacuum Cleaners", "Water Dispensers", "Water Purifiers", "Sewing Machines", "Appliance Parts"],
  "Furniture & household": ["Sofas & Armchairs", "Beds & Bed Frames", "Mattresses", "Wardrobes", "Tables", "Chairs", "Dining Furniture", "Office Furniture", "Outdoor Furniture", "Storage & Shelving", "Kitchen Cabinets", "Furniture Accessories", "Bedding", "Curtains & Blinds", "Rugs & Carpets", "Lighting", "Home Decor", "Mirrors", "Clocks", "Cookware", "Bakeware", "Kitchen Utensils", "Tableware", "Bathroom Accessories", "Laundry Accessories", "Cleaning Supplies", "Home Organization"],
  "Fashion & accessories": ["Men's Clothing", "Women's Clothing", "Children's Clothing", "Baby Clothing", "Traditional Clothing", "School Uniforms", "Workwear", "Sportswear", "Underwear & Sleepwear", "Men's Shoes", "Women's Shoes", "Children's Shoes", "Bags & Handbags", "Backpacks", "Luggage", "Watches", "Jewellery", "Belts", "Hats & Caps", "Sunglasses", "Fashion Accessories", "Fabrics", "Sewing Supplies"],
  "Beauty & personal care": ["Skincare", "Haircare", "Hair Extensions & Wigs", "Makeup", "Fragrances", "Nail Care", "Bath & Body", "Oral Care", "Grooming & Shaving", "Personal Hygiene", "Beauty Tools", "Salon Equipment", "Spa Equipment"],
  "Vehicles & transport": ["Cars", "Motorcycles", "Scooters", "Bicycles", "Electric Bicycles", "Vehicle Parts", "Vehicle Accessories", "Tyres & Wheels", "Car Batteries", "Car Audio", "Vehicle Maintenance Supplies", "Helmets & Riding Gear", "Commercial Vehicles", "Trailers", "Boats & Marine Equipment"],
  "Tools, building & power": ["Hand Tools", "Power Tools", "Tool Storage", "Building Materials", "Hardware", "Plumbing Supplies", "Electrical Supplies", "Paints & Finishes", "Doors & Windows", "Flooring & Tiles", "Roofing Materials", "Bathroom Fixtures", "Kitchen Fixtures", "Safety Equipment", "Generators", "Solar Panels", "Solar Accessories", "Inverters", "Power Banks", "Rechargeable Batteries", "UPS & Power Protection", "Water Pumps", "Welding Equipment", "Industrial Machinery", "Machine Parts"],
  "Business & office": ["Office Supplies", "Stationery", "Paper Products", "Ink & Toner", "POS Equipment", "Shop Fittings", "Display Equipment", "Packaging Supplies", "Commercial Kitchen Equipment", "Restaurant Supplies", "Commercial Refrigeration", "Security Cameras", "Security Equipment", "Fire Safety Equipment", "Professional Equipment"],
  "Sports, hobbies & leisure": ["Fitness Equipment", "Sports Equipment", "Football Equipment", "Basketball Equipment", "Swimming Equipment", "Cycling Accessories", "Camping Equipment", "Fishing Equipment", "Outdoor Recreation", "Musical Instruments", "Musical Instrument Accessories", "Art Supplies", "Craft Supplies", "Collectibles", "Board Games", "Toys", "Educational Toys", "Party Supplies"],
  "Baby, health & accessibility": ["Baby Feeding", "Baby Care", "Baby Furniture", "Strollers & Car Seats", "Maternity Products", "Mobility Aids", "Accessibility Equipment", "Health Monitoring Devices", "Medical Equipment", "First Aid Supplies", "Wellness Products"],
  "Food, farming & garden": ["Food & Groceries", "Beverages", "Fresh Produce", "Grains & Cereals", "Cooking Ingredients", "Snacks", "Animal Feed", "Pet Food", "Pet Accessories", "Farm Equipment", "Agricultural Tools", "Seeds & Plants", "Fertilizers", "Irrigation Equipment", "Garden Tools", "Garden Supplies", "Livestock Equipment"],
  "Books & other products": ["Books", "Textbooks", "School Supplies", "Religious Items", "Gift Items", "Souvenirs", "Other Products"],
}

export function categoryChoices(saved: { name: string; status: string }[], current = "") {
  const normalize = (name: string) => name.trim().toLowerCase()
  const used = new Set(saved.map(row => normalize(row.name)))
  const groups: Record<string, string[]> = {}
  groups["Your store categories"] = saved.filter(row => row.status === "Active").map(row => row.name).sort((a, b) => a.localeCompare(b))
  if (current && !groups["Your store categories"].includes(current)) groups["Current category"] = [current]
  if (current) used.add(normalize(current))
  for (const [group, names] of Object.entries(productCategoryGroups)) {
    groups[group] = names.filter(name => { const key = normalize(name); if (used.has(key)) return false; used.add(key); return true })
  }
  return Object.entries(groups).filter(([, names]) => names.length > 0)
}
