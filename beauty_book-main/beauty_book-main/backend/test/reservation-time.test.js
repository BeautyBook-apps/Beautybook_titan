import test from 'node:test';
import assert from 'node:assert/strict';
import {getReservationTime} from '../../src/lib/reservationTime.js';

test('appointment time prefers the canonical selected slot over a legacy midnight placeholder',()=>{
  assert.equal(getReservationTime({time:'00:00',time_slot:'14:30'}),'14:30');
  assert.equal(getReservationTime({time:'09:15'}),'09:15');
  assert.equal(getReservationTime({time_slot:'16:45'}),'16:45');
});

test('appointment time supports current UI shapes and rejects malformed values',()=>{
  assert.equal(getReservationTime({time:'00:00',selectedTime:'11:20'}),'11:20');
  assert.equal(getReservationTime({time_slot:'18:10:00'}),'18:10');
  assert.equal(getReservationTime({time:'not-a-time'}),'');
  assert.equal(getReservationTime({}),'');
});

