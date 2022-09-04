import spotify from "spotify-web-api-node";
import { spotifyClientID, spotifySecret } from "../config.json";

export class Spotify {
  private client = new spotify({
    clientId: spotifyClientID,
    clientSecret: spotifySecret
  });

  public async init() {
    const {
      body: { access_token }
    } = await this.client.clientCredentialsGrant();
    this.client.setAccessToken(access_token);

    return this;
  }

  public async processPlaylists(ids: string[]) {
    const processed: Processed[] = [];

    for (const id of ids) {
      const playlist = await this.client.getPlaylist(id);
      const { name } = playlist.body;
      const { description } = playlist.body;
      const image = playlist.body.images[0].url;

      const songs = await this.getSpotifyTracks(id);
      processed.push({ id, name, description, image, songs });
    }

    return processed;
  }

  private async getSpotifyTracks(id: string) {
    const songs = [];
    let next = true;
    let offset = 0;

    while (next) {
      const {
        body: { items, next: nextURL }
      } = await this.client.getPlaylistTracks(id, { offset });
      if (!nextURL) next = false;
      else if (nextURL)
        offset = Number(nextURL.split("offset=")[1].split("&")[0]);
      songs.push(...items);
    }

    return songs;
  }
}

export interface PlaylistObject extends SpotifyApi.PlaylistTrackObject {
  youtube?: string;
}

export interface Processed {
  id: string;
  name: string;
  description: string | null;
  image: string;
  songs: PlaylistObject[];
}
