import { describe, it, expect } from 'bun:test'
import { graphContactToContact } from '@/server/contacts/providers/microsoft'
import { personToContact } from '@/server/contacts/providers/google'

describe('graphContactToContact (Microsoft)', () => {
  it('maps names, org, typed phones and emails', () => {
    const c = graphContactToContact({
      id: 'AAA',
      displayName: 'Jane Doe',
      givenName: 'Jane',
      surname: 'Doe',
      companyName: 'Acme',
      emailAddresses: [{ address: 'jane@x.com', name: 'Jane' }, { address: '' }],
      mobilePhone: '+33611111111',
      homePhones: ['+33122222222'],
      businessPhones: ['+33133333333', ''],
    })
    expect(c.id).toBe('AAA')
    expect(c.displayName).toBe('Jane Doe')
    expect(c.organization).toBe('Acme')
    expect(c.phones).toEqual([
      { number: '+33611111111', type: 'mobile' },
      { number: '+33122222222', type: 'home' },
      { number: '+33133333333', type: 'work' },
    ])
    expect(c.emails).toEqual([{ email: 'jane@x.com' }])
  })

  it('falls back to given+surname and (no name)', () => {
    expect(graphContactToContact({ id: '1', givenName: 'A', surname: 'B' }).displayName).toBe('A B')
    expect(graphContactToContact({ id: '2' }).displayName).toBe('(no name)')
  })
})

describe('personToContact (Google People)', () => {
  it('maps the first name, phones (cell→mobile) and emails', () => {
    const c = personToContact({
      resourceName: 'people/c123',
      names: [{ displayName: 'Bob Smith', givenName: 'Bob', familyName: 'Smith' }],
      emailAddresses: [{ value: 'bob@x.com', type: 'home' }],
      phoneNumbers: [{ value: '+33644444444', type: 'cell' }, { value: '+33155555555', type: 'home' }],
      organizations: [{ name: 'Globex' }],
    })
    expect(c.id).toBe('people/c123')
    expect(c.displayName).toBe('Bob Smith')
    expect(c.organization).toBe('Globex')
    expect(c.phones).toEqual([
      { number: '+33644444444', type: 'mobile' },
      { number: '+33155555555', type: 'home' },
    ])
    expect(c.emails).toEqual([{ email: 'bob@x.com', type: 'home' }])
  })

  it('handles missing names', () => {
    expect(personToContact({ resourceName: 'people/x' }).displayName).toBe('(no name)')
  })
})
