import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { Character, Mission, Role, User } from './models';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  // Personajes
  myCharacters() { return this.http.get<Character[]>(`${API}/characters`); }
  allCharacters() { return this.http.get<Character[]>(`${API}/all-characters`); }
  createCharacter(c: Partial<Character>) { return this.http.post<Character>(`${API}/characters`, c); }
  updateCharacter(id: number, c: Partial<Character>) { return this.http.put<Character>(`${API}/characters/${id}`, c); }
  deleteCharacter(id: number) { return this.http.delete<void>(`${API}/characters/${id}`); }

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
}
