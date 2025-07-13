import {
    GeocodeResponse,
    PlacesSearchResponse,
    PlaceDetailsResponse,
    DistanceMatrixResponse,
    ElevationResponse,
    DirectionsResponse
  } from './types.js';
  
  export class GoogleMapsService {
    private apiKey: string;
  
    constructor(apiKey: string) {
      this.apiKey = apiKey;
    }
  
    async geocode(address: string) {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.append("address", address);
      url.searchParams.append("key", this.apiKey);
  
      const response = await fetch(url.toString());
      const data = await response.json() as GeocodeResponse;
  
      if (data.status !== "OK") {
        return {
          error: `Geocoding failed: ${data.error_message || data.status}`
        };
      }
  
      return {
        location: data.results[0].geometry.location,
        formatted_address: data.results[0].formatted_address,
        place_id: data.results[0].place_id
      };
    }
  
    async reverseGeocode(latitude: number, longitude: number) {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.append("latlng", `${latitude},${longitude}`);
      url.searchParams.append("key", this.apiKey);
  
      const response = await fetch(url.toString());
      const data = await response.json() as GeocodeResponse;
  
      if (data.status !== "OK") {
        return {
          error: `Reverse geocoding failed: ${data.error_message || data.status}`
        };
      }
  
      return {
        formatted_address: data.results[0].formatted_address,
        place_id: data.results[0].place_id,
        address_components: data.results[0].address_components
      };
    }
  
    async searchPlaces(
      query: string,
      location?: { latitude: number; longitude: number },
      radius?: number
    ) {
      const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
      url.searchParams.append("query", query);
      url.searchParams.append("key", this.apiKey);
  
      if (location) {
        url.searchParams.append("location", `${location.latitude},${location.longitude}`);
      }
      if (radius) {
        url.searchParams.append("radius", radius.toString());
      }
  
      const response = await fetch(url.toString());
      const data = await response.json() as PlacesSearchResponse;
  
      if (data.status !== "OK") {
        return {
          error: `Place search failed: ${data.error_message || data.status}`
        };
      }
  
      return {
        places: data.results.map((place) => ({
          name: place.name,
          formatted_address: place.formatted_address,
          location: place.geometry.location,
          place_id: place.place_id,
          rating: place.rating,
          types: place.types
        }))
      };
    }
  
    async getPlaceDetails(place_id: string) {
      const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      url.searchParams.append("place_id", place_id);
      url.searchParams.append("key", this.apiKey);
  
      const response = await fetch(url.toString());
      const data = await response.json() as PlaceDetailsResponse;
  
      if (data.status !== "OK") {
        return {
          error: `Place details request failed: ${data.error_message || data.status}`
        };
      }
  
      return {
        name: data.result.name,
        formatted_address: data.result.formatted_address,
        location: data.result.geometry.location,
        formatted_phone_number: data.result.formatted_phone_number,
        website: data.result.website,
        rating: data.result.rating,
        reviews: data.result.reviews,
        opening_hours: data.result.opening_hours
      };
    }
  
    async getDistanceMatrix(
      origins: string[],
      destinations: string[],
      mode: "driving" | "walking" | "bicycling" | "transit" = "driving"
    ) {
      const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
      url.searchParams.append("origins", origins.join("|"));
      url.searchParams.append("destinations", destinations.join("|"));
      url.searchParams.append("mode", mode);
      url.searchParams.append("key", this.apiKey);
  
      const response = await fetch(url.toString());
      const data = await response.json() as DistanceMatrixResponse;
  
      if (data.status !== "OK") {
        return {
          error: `Distance matrix request failed: ${data.error_message || data.status}`
        };
      }
  
      return {
        origin_addresses: data.origin_addresses,
        destination_addresses: data.destination_addresses,
        results: data.rows.map((row) => ({
          elements: row.elements.map((element) => ({
            status: element.status,
            duration: element.duration,
            distance: element.distance
          }))
        }))
      };
    }
  
    async getElevation(locations: Array<{ latitude: number; longitude: number }>) {
      const url = new URL("https://maps.googleapis.com/maps/api/elevation/json");
      const locationString = locations
        .map((loc) => `${loc.latitude},${loc.longitude}`)
        .join("|");
      url.searchParams.append("locations", locationString);
      url.searchParams.append("key", this.apiKey);
  
      const response = await fetch(url.toString());
      const data = await response.json() as ElevationResponse;
  
      if (data.status !== "OK") {
        return {
          error: `Elevation request failed: ${data.error_message || data.status}`
        };
      }
  
      return {
        results: data.results.map((result) => ({
          elevation: result.elevation,
          location: result.location,
          resolution: result.resolution
        }))
      };
    }
  
    async getDirections(
      origin: string,
      destination: string,
      mode: "driving" | "walking" | "bicycling" | "transit" = "driving"
    ) {
      const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
      url.searchParams.append("origin", origin);
      url.searchParams.append("destination", destination);
      url.searchParams.append("mode", mode);
      url.searchParams.append("key", this.apiKey);
  
      const response = await fetch(url.toString());
      const data = await response.json() as DirectionsResponse;
  
      if (data.status !== "OK") {
        return {
          error: `Directions request failed: ${data.error_message || data.status}`
        };
      }
  
      return {
        routes: data.routes.map((route) => ({
          summary: route.summary,
          distance: route.legs[0].distance,
          duration: route.legs[0].duration,
          steps: route.legs[0].steps.map((step) => ({
            instructions: step.html_instructions,
            distance: step.distance,
            duration: step.duration,
            travel_mode: step.travel_mode
          }))
        }))
      };
    }
  } 