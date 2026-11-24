import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { CoinKey } from './dnd';
import {
  Character, CharacterImage, GalleryCharacter, Merchant, MerchantPose,
  Mission, Role, ShopItem, ShopPurchase, ShopResponse, User,
} from './models';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // Personajes
  myCharacters() { return this.http.get<Character[]>(`${API}/characters`); }
  character(id: number) { return this.http.get<Character>(`${API}/characters/${id}`); }
  allCharacters() { return this.http.get<Character[]>(`${API}/all-characters`); }
  createCharacter(c: Partial<Character>) { return this.http.post<Character>(`${API}/characters`, c); }
  updateCharacter(id: number, c: Partial<Character>) { return this.http.put<Character>(`${API}/characters/${id}`, c); }
  killCharacter(id: number) { return this.http.post<Character>(`${API}/characters/${id}/kill`, {}); }
  deleteCharacter(id: number) { return this.http.delete<void>(`${API}/characters/${id}`); }
  uploadAvatar(id: number, blob: Blob) {
    const ext = blob.type.split('/')[1] ?? 'png';
    const fd = new FormData();
    fd.append('avatar', blob, `avatar.${ext}`);
    return this.http.post<Character>(`${API}/characters/${id}/avatar`, fd);
  }
  gallery() { return this.http.get<{ characters: GalleryCharacter[]; without_portrait: number }>(`${API}/gallery`); }
  deleteAvatar(id: number) { return this.http.delete<Character>(`${API}/characters/${id}/avatar`); }
  uploadCharacterImage(id: number, blob: Blob, caption?: string, showInGallery = true) {
    const ext = blob.type.split('/')[1] ?? 'png';
    const fd = new FormData();
    fd.append('image', blob, `image.${ext}`);
    if (caption) fd.append('caption', caption);
    fd.append('show_in_gallery', showInGallery ? '1' : '0');
    return this.http.post<CharacterImage>(`${API}/characters/${id}/images`, fd);
  }
  updateCharacterImage(characterId: number, imageId: number, patch: { show_in_gallery?: boolean; caption?: string | null }) {
    return this.http.patch<CharacterImage>(`${API}/characters/${characterId}/images/${imageId}`, patch);
  }
  deleteCharacterImage(characterId: number, imageId: number) {
    return this.http.delete<void>(`${API}/characters/${characterId}/images/${imageId}`);
  }
  adjustWallet(characterId: number, deltas: Partial<Record<CoinKey, number>>) {
    return this.http.post<Character>(`${API}/characters/${characterId}/wallet/adjust`, deltas);
  }
  convertWallet(characterId: number, payload: { compact: true } | { from: CoinKey; to: CoinKey; amount: number }) {
    return this.http.post<Character>(`${API}/characters/${characterId}/wallet/convert`, payload);
  }

  // Misiones
  missions() { return this.http.get<Mission[]>(`${API}/missions`); }
  createMission(m: Partial<Mission>) { return this.http.post<Mission>(`${API}/missions`, m); }
  updateMission(id: number, m: Partial<Mission>) { return this.http.put<Mission>(`${API}/missions/${id}`, m); }
  deleteMission(id: number) { return this.http.delete<void>(`${API}/missions/${id}`); }

  // Administración
  users() { return this.http.get<User[]>(`${API}/admin/users`); }
  setRole(id: number, role: Role) { return this.http.patch<User>(`${API}/admin/users/${id}/role`, { role }); }
  setAdmin(id: number, is_admin: boolean) { return this.http.patch<User>(`${API}/admin/users/${id}/admin`, { is_admin }); }
  setActive(id: number, is_active: boolean) { return this.http.patch<User>(`${API}/admin/users/${id}/active`, { is_active }); }

  // Tienda
  shop() { return this.http.get<ShopResponse>(`${API}/shop`); }
  buyShopItem(itemId: number) {
    return this.http.post<{ purchase: ShopPurchase; buyer: ShopResponse['buyer'] }>(`${API}/shop/items/${itemId}/buy`, {});
  }
  shopMerchants() { return this.http.get<Merchant[]>(`${API}/shop/merchants`); }
  createMerchant(m: Partial<Merchant>) { return this.http.post<Merchant>(`${API}/shop/merchants`, m); }
  updateMerchant(id: number, m: Partial<Merchant>) { return this.http.put<Merchant>(`${API}/shop/merchants/${id}`, m); }
  deleteMerchant(id: number) { return this.http.delete<void>(`${API}/shop/merchants/${id}`); }
  activateMerchant(id: number) { return this.http.post<Merchant>(`${API}/shop/merchants/${id}/activate`, {}); }
  uploadMerchantPose(merchantId: number, pose: MerchantPose, file: File) {
    const fd = new FormData();
    fd.append('image', file);
    return this.http.post<Merchant>(`${API}/shop/merchants/${merchantId}/poses/${pose}`, fd);
  }
  deleteMerchantPose(merchantId: number, pose: MerchantPose) {
    return this.http.delete<Merchant>(`${API}/shop/merchants/${merchantId}/poses/${pose}`);
  }
  createShopItem(merchantId: number, fd: FormData) {
    return this.http.post<ShopItem>(`${API}/shop/merchants/${merchantId}/items`, fd);
  }
  updateShopItem(itemId: number, fd: FormData) {
    return this.http.post<ShopItem>(`${API}/shop/items/${itemId}`, fd);
  }
  deleteShopItem(itemId: number) { return this.http.delete<void>(`${API}/shop/items/${itemId}`); }
  shopPurchases() { return this.http.get<ShopPurchase[]>(`${API}/shop/purchases`); }
}
