import { getHomeLostPetReports, getPublicReunionStories } from "@/lib/reports";
import { pets } from "@/lib/mock-data";

export async function getHomePageData() {
  let homePets = [];
  let reunionStories = [];

  try {
    homePets = await getHomeLostPetReports();
  } catch (error) {
    homePets = [];
  }

  try {
    reunionStories = await getPublicReunionStories();
  } catch (error) {
    reunionStories = [];
  }

  if (homePets.length === 0) {
    homePets = pets.filter((pet) => pet.status === "active");
  }

  return {
    homePets,
    reunionStories,
  };
}
