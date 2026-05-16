import { SupabaseTaxonomyRepository } from '@/infrastructure/repositories/SupabaseTaxonomyRepository';

const repo = new SupabaseTaxonomyRepository();

export async function fetchCategories() {
  return repo.getCategories();
}

export default {
  fetchCategories,
};
