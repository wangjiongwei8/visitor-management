import { inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { vehicles, visitors } from '@/lib/schema';

export interface AppointmentVehicleSource {
  id: number;
  visitorId?: number | null;
}

export interface VehicleDisplayInfo {
  licensePlate: string;
  vehicleModel: string;
  vehicleType: string;
}

export interface FollowerDisplayInfo {
  id: string;
  name: string;
  phone: string;
  licensePlate: string;
}

export interface AppointmentVehicleSummary {
  licensePlate: string;
  vehicleInfo: VehicleDisplayInfo[];
  followers: FollowerDisplayInfo[];
}

interface VehicleRow {
  id: number;
  appointmentId: number;
  licensePlate: string;
  vehicleModel: string | null;
  vehicleType: string;
  followerName?: string | null;
  followerPhone?: string | null;
}

interface VisitorJsonRow {
  id: number;
  vehicleInfo: unknown;
  entourageInfo: unknown;
}

const emptySummary = (): AppointmentVehicleSummary => ({
  licensePlate: '',
  vehicleInfo: [],
  followers: [],
});

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeVehicleInfo(value: unknown): VehicleDisplayInfo[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const record = asRecord(item);
      return {
        licensePlate: asText(record.licensePlate),
        vehicleModel: asText(record.vehicleModel),
        vehicleType: asText(record.vehicleType) || 'car',
      };
    })
    .filter((item) => item.licensePlate);
}

function normalizeFollowers(value: unknown): FollowerDisplayInfo[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      const record = asRecord(item);
      const name = asText(record.name);
      return {
        id: asText(record.id) || `visitor-json-${index}`,
        name,
        phone: asText(record.phone),
        licensePlate: asText(record.licensePlate),
      };
    })
    .filter((item) => item.name);
}

async function fetchVehicleRows(appointmentIds: number[]): Promise<VehicleRow[]> {
  if (appointmentIds.length === 0) return [];

  try {
    return await db
      .select()
      .from(vehicles)
      .where(inArray(vehicles.appointmentId, appointmentIds));
  } catch (error) {
    console.error('Query vehicles with follower columns failed, using compatibility query:', error);
  }

  try {
    const result = await db.execute(sql`
      SELECT
        id,
        appointment_id AS "appointmentId",
        license_plate AS "licensePlate",
        vehicle_model AS "vehicleModel",
        vehicle_type AS "vehicleType",
        NULL::text AS "followerName",
        NULL::text AS "followerPhone"
      FROM vehicles
      WHERE appointment_id IN (${sql.join(appointmentIds.map((id) => sql`${id}`), sql`, `)})
    `);
    return result.rows as unknown as VehicleRow[];
  } catch (error) {
    console.error('Query vehicles compatibility fallback failed:', error);
    return [];
  }
}

async function fetchVisitorJsonRows(visitorIds: number[]): Promise<Map<number, VisitorJsonRow>> {
  const visitorMap = new Map<number, VisitorJsonRow>();
  if (visitorIds.length === 0) return visitorMap;

  try {
    const rows = await db
      .select({
        id: visitors.id,
        vehicleInfo: visitors.vehicleInfo,
        entourageInfo: visitors.entourageInfo,
      })
      .from(visitors)
      .where(inArray(visitors.id, visitorIds));

    rows.forEach((row) => visitorMap.set(row.id, row));
  } catch (error) {
    console.error('Query visitor JSON vehicle data failed:', error);
  }

  return visitorMap;
}

export async function getAppointmentVehicleSummaries(
  appointments: AppointmentVehicleSource[],
): Promise<Map<number, AppointmentVehicleSummary>> {
  const summaries = new Map<number, AppointmentVehicleSummary>();
  if (appointments.length === 0) return summaries;

  const appointmentIds = appointments.map((appointment) => appointment.id);
  const visitorIds = Array.from(new Set(
    appointments
      .map((appointment) => appointment.visitorId)
      .filter((id): id is number => typeof id === 'number'),
  ));

  const [vehicleRows, visitorRows] = await Promise.all([
    fetchVehicleRows(appointmentIds),
    fetchVisitorJsonRows(visitorIds),
  ]);

  const vehiclesByAppointment = new Map<number, VehicleRow[]>();
  vehicleRows.forEach((vehicle) => {
    const group = vehiclesByAppointment.get(vehicle.appointmentId) || [];
    group.push(vehicle);
    vehiclesByAppointment.set(vehicle.appointmentId, group);
  });

  appointments.forEach((appointment) => {
    const rows = vehiclesByAppointment.get(appointment.id) || [];
    const visitorJson = appointment.visitorId ? visitorRows.get(appointment.visitorId) : undefined;

    const rowVehicleInfo = rows.map((vehicle) => ({
      licensePlate: vehicle.licensePlate,
      vehicleModel: vehicle.vehicleModel || '',
      vehicleType: vehicle.vehicleType,
    })).filter((vehicle) => vehicle.licensePlate);

    const rowFollowers = rows
      .filter((vehicle) => vehicle.followerName)
      .map((vehicle) => ({
        id: String(vehicle.id),
        name: vehicle.followerName || '',
        phone: vehicle.followerPhone || '',
        licensePlate: vehicle.licensePlate,
      }));

    const jsonVehicleInfo = normalizeVehicleInfo(visitorJson?.vehicleInfo);
    const jsonFollowers = normalizeFollowers(visitorJson?.entourageInfo);

    const vehicleInfo = rowVehicleInfo.length > 0 ? rowVehicleInfo : jsonVehicleInfo;
    const followers = rowFollowers.length > 0 ? rowFollowers : jsonFollowers;
    const mainVehicle = rows.find((vehicle) => !vehicle.followerName);

    summaries.set(appointment.id, {
      licensePlate: mainVehicle?.licensePlate || vehicleInfo[0]?.licensePlate || '',
      vehicleInfo,
      followers,
    });
  });

  return summaries;
}
